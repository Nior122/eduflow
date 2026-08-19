import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, parentCommSchema } from "@/lib/validations";
import { aiComplete, resolvePrompt } from "@/lib/ai/core";
import { aiGuard } from "@/lib/ai/guard";
import { computeStudentMetrics, getScopedStudent } from "@/lib/ai/metrics";
import type { UserRole } from "@prisma/client";

const STAFF_ROLES: UserRole[] = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"];

const SCENARIO_LABELS: Record<string, string> = {
  PROGRESS_REPORT: "progress report",
  ATTENDANCE_WARNING: "attendance warning",
  CONGRATULATIONS: "congratulations message",
  REMINDER: "friendly reminder",
  BEHAVIOR_REPORT: "behaviour report",
};

/**
 * POST /api/ai/parent-communication — AI Parent Communication Assistant
 * (Module 9). Drafts a professional message from real student data. The
 * teacher edits it in the UI, then POST /api/ai/parent-communication/send
 * delivers it through the messaging system.
 */
export async function POST(req: Request) {
  const guard = await aiGuard({ module: "parent_communication", roles: STAFF_ROLES });
  if (guard instanceof NextResponse) return guard;
  const { session, schoolId, userId } = guard;

  const body = await parseJsonBody(req).catch(() => null);
  const parsed = validate(parentCommSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const student = await getScopedStudent({
    studentId: parsed.data.studentId,
    schoolId,
    role: session.user.role,
    teacherId: session.user.teacherId ?? null,
    parentId: session.user.parentId ?? null,
    studentOwnId: session.user.studentId ?? null,
  });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  if (!student.parentId) {
    return NextResponse.json({ error: "This student has no linked parent" }, { status: 400 });
  }

  const metrics = await computeStudentMetrics(student.id, schoolId);
  const prompt = await resolvePrompt(schoolId, "parent_communication", {
    scenario: SCENARIO_LABELS[parsed.data.scenario] ?? "message",
    studentName: `${student.firstName} ${student.lastName}`,
    className: student.class?.name ?? "—",
    metricsJson: JSON.stringify(metrics),
    extraNotes: parsed.data.notes?.trim() ? `Additional notes from the teacher: ${parsed.data.notes.trim()}` : "",
  });

  const result = await aiComplete({
    schoolId,
    userId,
    module: "parent_communication",
    messages: [{ role: "user", content: prompt }],
  });

  return NextResponse.json({
    draft: result.text.trim(),
    scenario: parsed.data.scenario,
    student: { id: student.id, name: `${student.firstName} ${student.lastName}`, className: student.class?.name ?? null },
    parentId: student.parentId,
  });
}
