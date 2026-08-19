import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, workflowSchema } from "@/lib/validations";
import { staffGuard } from "@/lib/exams/guards";
import { canTransition, actionFor, ACTION_ROLES, RESULT_STATUSES } from "@/lib/exams/workflow";
import type { ResultStatus } from "@prisma/client";

const ACTION_TO_STATUS: Record<string, ResultStatus> = {
  SUBMIT: "SUBMITTED",
  APPROVE: "APPROVED",
  PUBLISH: "PUBLISHED",
  LOCK: "LOCKED",
  REJECT: "DRAFT",
};

/**
 * POST /api/results/workflow { resultIds, action, note? }
 * Moves results through Draft → Submitted → Approved → Published → Locked.
 * Publishing is blocked while any result in the same class×subject×term
 * sheet is still DRAFT/SUBMITTED (prevents publishing incomplete results).
 */
export async function POST(req: Request) {
  const g = await staffGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const role = g.session?.user?.role ?? "";
  const userId = g.session?.user?.id ?? "";

  const body = await parseJsonBody(req);
  const parsed = validate(workflowSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }
  const { resultIds, action, note } = parsed.data;

  const allowedRoles = ACTION_ROLES[action] ?? [];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden: you cannot perform this action" }, { status: 403 });
  }

  const toStatus = ACTION_TO_STATUS[action];
  const results = await prisma.result.findMany({
    where: { id: { in: resultIds }, class: { schoolId } },
    select: {
      id: true,
      status: true,
      classId: true,
      subjectId: true,
      academicSessionId: true,
      academicTermId: true,
    },
  });
  if (results.length === 0) {
    return NextResponse.json({ error: "No results found" }, { status: 404 });
  }
  if (results.length !== resultIds.length) {
    return NextResponse.json({ error: "Some results were not found" }, { status: 404 });
  }

  // Validate transitions.
  for (const r of results) {
    const ok =
      action === "REJECT"
        ? (r.status === "SUBMITTED" || r.status === "APPROVED")
        : canTransition(r.status, toStatus);
    if (!ok) {
      return NextResponse.json(
        { error: "Result " + r.id + " cannot move from " + r.status + " to " + toStatus },
        { status: 409 }
      );
    }
  }

  // Anti-incompleteness guard for PUBLISH: the whole subject sheet must be approved.
  if (action === "PUBLISH") {
    const first = results[0];
    const sheet = await prisma.result.findMany({
      where: {
        classId: first.classId,
        subjectId: first.subjectId,
        academicSessionId: first.academicSessionId ?? undefined,
        academicTermId: first.academicTermId ?? undefined,
      },
      select: { status: true },
    });
    const incomplete = sheet.filter((r) => r.status !== "APPROVED" && r.status !== "PUBLISHED");
    if (incomplete.length > 0) {
      return NextResponse.json(
        { error: "Cannot publish: " + incomplete.length + " result(s) in this sheet are not yet approved" },
        { status: 409 }
      );
    }
  }
  if (action === "LOCK") {
    const incomplete = results.filter((r) => r.status !== "PUBLISHED");
    if (incomplete.length > 0) {
      return NextResponse.json({ error: "Cannot lock: some results are not yet published" }, { status: 409 });
    }
  }

  const auditData =
    action === "APPROVE"
      ? { approvedById: userId, approvedAt: new Date() }
      : action === "PUBLISH"
        ? { publishedById: userId, publishedAt: new Date() }
        : action === "LOCK"
          ? { lockedById: userId, lockedAt: new Date() }
          : {};

  await prisma.$transaction([
    ...results.map((r) =>
      prisma.result.update({
        where: { id: r.id },
        data: { status: toStatus, ...auditData },
      })
    ),
    ...results.map((r) =>
      prisma.resultApprovalRecord.create({
        data: {
          resultId: r.id,
          action,
          fromStatus: r.status,
          toStatus,
          note: note ?? null,
          actorId: userId,
        },
      })
    ),
  ]);

  return NextResponse.json({
    ok: true,
    moved: results.length,
    fromStatus: results[0].status,
    toStatus,
    action,
    allowed: RESULT_STATUSES.indexOf(toStatus) < RESULT_STATUSES.length - 1 ? actionFor(toStatus, RESULT_STATUSES[RESULT_STATUSES.indexOf(toStatus) + 1]) : null,
  });
}
