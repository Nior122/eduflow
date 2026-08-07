import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, gradeSubmissionSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string; submissionId: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, submissionId } = await params;

  try {
    const body = await req.json();
    const parsed = validate(gradeSubmissionSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }

    // Teachers may grade only submissions on their own assignments.
    const assignmentWhere: Record<string, unknown> = { id, schoolId };
    if (session?.user?.role === "TEACHER") {
      assignmentWhere.teacherId = session.user.teacherId ?? "__none__";
    }
    const assignment = await prisma.assignment.findFirst({
      where: assignmentWhere,
      select: { id: true },
    });
    if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

    const submission = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        grade: parsed.data.grade,
        feedback: parsed.data.feedback ?? null,
        gradedAt: new Date(),
      },
    });
    return NextResponse.json({ submission });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    console.error("Failed to grade submission:", error);
    return NextResponse.json({ error: "Failed to grade submission" }, { status: 500 });
  }
}
