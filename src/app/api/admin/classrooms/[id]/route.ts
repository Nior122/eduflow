import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, classroomUpdateSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = validate(classroomUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.classroom.findFirst({
      where: { id, schoolId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });

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

    const updateData: Prisma.ClassroomUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.roomNumber !== undefined && { roomNumber: data.roomNumber ?? null }),
      ...(data.location !== undefined && { location: data.location ?? null }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
      ...(data.classId !== undefined && { classId: data.classId }),
      ...(data.classTeacherId !== undefined && { classTeacherId: data.classTeacherId }),
      ...(data.assistantTeacherId !== undefined && { assistantTeacherId: data.assistantTeacherId }),
    };
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const classroom = await prisma.classroom.update({ where: { id }, data: updateData });
    return NextResponse.json({ classroom });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
    }
    console.error("Failed to update classroom:", error);
    return NextResponse.json({ error: "Failed to update classroom" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.classroom.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });

    await prisma.classroom.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete classroom:", error);
    return NextResponse.json({ error: "Failed to delete classroom" }, { status: 500 });
  }
}
