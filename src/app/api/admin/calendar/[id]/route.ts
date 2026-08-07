import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, calendarEventUpdateSchema } from "@/lib/validations";
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
    const body = await req.json();
    const parsed = validate(calendarEventUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.calendarEvent.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const updateData: Prisma.CalendarEventUpdateInput = {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.eventDate !== undefined && { eventDate: new Date(data.eventDate) }),
      ...(data.startTime !== undefined && { startTime: data.startTime ?? null }),
      ...(data.endTime !== undefined && { endTime: data.endTime ?? null }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.classId !== undefined && { classId: data.classId }),
    };

    const event = await prisma.calendarEvent.update({ where: { id }, data: updateData });
    return NextResponse.json({ event });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    console.error("Failed to update event:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const result = await prisma.calendarEvent.deleteMany({ where: { id, schoolId } });
  if (result.count === 0) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
