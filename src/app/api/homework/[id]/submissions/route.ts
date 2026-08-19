import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, homeworkSubmissionSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const schoolId = session.user.schoolId;

  const { id } = await params;

  const homework = await prisma.homework.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });
  if (!homework) return NextResponse.json({ error: "Homework not found" }, { status: 404 });

  if (session.user.role === "STUDENT") {
    const submissions = await prisma.homeworkSubmission.findMany({
      where: { homeworkId: id, studentId: session.user.studentId ?? "__none__" },
    });
    return NextResponse.json({ submissions });
  }

  const submissions = await prisma.homeworkSubmission.findMany({
    where: { homeworkId: id },
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
    const parsed = validate(homeworkSubmissionSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }

    const homework = await prisma.homework.findFirst({
      where: {
        id,
        schoolId: session?.user?.schoolId ?? "__none__",
        class: { students: { some: { id: studentId } } },
      },
      select: { id: true },
    });
    if (!homework) return NextResponse.json({ error: "Homework not found for your class" }, { status: 404 });

    const existing = await prisma.homeworkSubmission.findUnique({
      where: { homeworkId_studentId: { homeworkId: id, studentId } },
      select: { gradedAt: true },
    });
    if (existing?.gradedAt) {
      return NextResponse.json({ error: "This submission has already been reviewed and can no longer be edited" }, { status: 400 });
    }

    const submission = await prisma.homeworkSubmission.upsert({
      where: { homeworkId_studentId: { homeworkId: id, studentId } },
      create: { homeworkId: id, studentId, content: parsed.data.content },
      update: { content: parsed.data.content, submittedAt: new Date() },
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Homework not found" }, { status: 404 });
    }
    console.error("Failed to submit homework:", error);
    return NextResponse.json({ error: "Failed to submit homework" }, { status: 500 });
  }
}
