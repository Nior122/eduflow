import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, classroomSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const classrooms = await prisma.classroom.findMany({
    where: { schoolId, isActive: true },
    include: {
      class: {
        select: { id: true, name: true, _count: { select: { students: true } } },
      },
      classTeacher: { select: { id: true, firstName: true, lastName: true } },
      assistantTeacher: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    classrooms: classrooms.map((c) => ({
      ...c,
      studentCount: c.class?._count.students ?? 0,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(classroomSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    if (data.classId) {
      const cls = await prisma.class.findFirst({
        where: { id: data.classId, schoolId, isActive: true },
        select: { id: true },
      });
      if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }
    for (const teacherId of [data.classTeacherId, data.assistantTeacherId]) {
      if (teacherId) {
        const teacher = await prisma.teacher.findFirst({
          where: { id: teacherId, schoolId, isActive: true },
          select: { id: true },
        });
        if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      }
    }

    const classroom = await prisma.classroom.create({
      data: {
        name: data.name,
        roomNumber: data.roomNumber ?? null,
        location: data.location ?? null,
        capacity: data.capacity ?? null,
        classId: data.classId ?? null,
        classTeacherId: data.classTeacherId ?? null,
        assistantTeacherId: data.assistantTeacherId ?? null,
        schoolId,
      },
    });
    return NextResponse.json({ classroom }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A classroom with this name already exists" }, { status: 409 });
    }
    console.error("Failed to create classroom:", error);
    return NextResponse.json({ error: "Failed to create classroom" }, { status: 500 });
  }
}
