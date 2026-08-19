import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, timetableEntrySchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(timetableEntrySchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.timetableEntry.findFirst({
      where: { id, schoolId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Timetable entry not found" }, { status: 404 });

    const updateData: Prisma.TimetableEntryUpdateInput = {
      ...(data.day !== undefined && { day: data.day }),
      ...(data.startTime !== undefined && { startTime: data.startTime }),
      ...(data.endTime !== undefined && { endTime: data.endTime }),
      ...(data.classId !== undefined && { classId: data.classId }),
      ...(data.subjectId !== undefined && { subjectId: data.subjectId }),
      ...(data.teacherId !== undefined && { teacherId: data.teacherId }),
      ...(data.classroomId !== undefined && { classroomId: data.classroomId }),
      ...(data.sessionId !== undefined && { sessionId: data.sessionId }),
      ...(data.termId !== undefined && { termId: data.termId }),
    };

    const entry = await prisma.timetableEntry.update({ where: { id }, data: updateData });
    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Timetable entry not found" }, { status: 404 });
    }
    console.error("Failed to update timetable entry:", error);
    return NextResponse.json({ error: "Failed to update timetable entry" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const result = await prisma.timetableEntry.deleteMany({ where: { id, schoolId } });
  if (result.count === 0) return NextResponse.json({ error: "Timetable entry not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
