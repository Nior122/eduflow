import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, submissionSchema } from "@/lib/validations";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const schoolId = session.user.schoolId;

  const { id } = await params;

  const assignment = await prisma.assignment.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  if (session.user.role === "STUDENT") {
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: id, studentId: session.user.studentId ?? "__none__" },
    });
    return NextResponse.json({ submissions });
  }

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentId: id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
    },
    orderBy: { submittedAt: "desc" },
  });
  return NextResponse.json({ submissions });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ["STUDENT"]);
  if (denied) return denied;
  const studentId = session?.user?.studentId;
  if (!studentId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(submissionSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }

    // The student must belong to the assignment's class.
    const assignment = await prisma.assignment.findFirst({
      where: {
        id,
        schoolId: session?.user?.schoolId ?? "__none__",
        class: { students: { some: { id: studentId } } },
      },
      select: { id: true },
    });
    if (!assignment) return NextResponse.json({ error: "Assignment not found for your class" }, { status: 404 });

    const existing = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: id, studentId } },
      select: { gradedAt: true },
    });
    if (existing?.gradedAt) {
      return NextResponse.json({ error: "This submission has already been graded and can no longer be edited" }, { status: 400 });
    }

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: id, studentId } },
      create: { assignmentId: id, studentId, content: parsed.data.content },
      update: { content: parsed.data.content, submittedAt: new Date() },
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    console.error("Failed to submit assignment:", error);
    return NextResponse.json({ error: "Failed to submit assignment" }, { status: 500 });
  }
}
