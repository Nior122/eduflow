import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, classSubjectSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const classSubjects = await prisma.classSubject.findMany({
    where: { class: { schoolId } },
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
  });
  return NextResponse.json({ classSubjects });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(classSubjectSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { classId, subjectId, teacherId } = parsed.data;

    // Both class and subject must belong to this school.
    const [cls, subject] = await Promise.all([
      prisma.class.findFirst({ where: { id: classId, schoolId, isActive: true }, select: { id: true } }),
      prisma.subject.findFirst({ where: { id: subjectId, schoolId, isActive: true }, select: { id: true } }),
    ]);
    if (!cls || !subject) {
      return NextResponse.json({ error: "Class or subject not found" }, { status: 404 });
    }
    if (teacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: teacherId, schoolId, isActive: true },
        select: { id: true },
      });
      if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    const classSubject = await prisma.classSubject.create({
      data: { classId, subjectId, teacherId: teacherId ?? null },
    });
    return NextResponse.json({ classSubject }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "This subject is already assigned to that class" },
        { status: 409 }
      );
    }
    console.error("Failed to create assignment:", error);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}

/** Assign (or clear) the teacher for an existing class+subject pair. */
export async function PATCH(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(classSubjectSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { classId, subjectId, teacherId } = parsed.data;

    if (teacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: teacherId, schoolId, isActive: true },
        select: { id: true },
      });
      if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    const result = await prisma.classSubject.updateMany({
      where: { classId, subjectId, class: { schoolId } },
      data: { teacherId: teacherId ?? null },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update assignment:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}

/** Remove a class+subject assignment (?classId=&subjectId=). */
export async function DELETE(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const subjectId = searchParams.get("subjectId");
  if (!classId || !subjectId) {
    return NextResponse.json({ error: "classId and subjectId are required" }, { status: 400 });
  }

  const result = await prisma.classSubject.deleteMany({
    where: { classId, subjectId, class: { schoolId } },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
