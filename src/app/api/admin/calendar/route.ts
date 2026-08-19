import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, calendarEventSchema } from "@/lib/validations";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = { schoolId };
  if (from || to) {
    where.eventDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (type) where.type = type;

  const events = await prisma.calendarEvent.findMany({
    where,
    include: { class: { select: { id: true, name: true } } },
    orderBy: { eventDate: "asc" },
    take: 200,
  });
  return NextResponse.json({ events });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(calendarEventSchema, body);
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

    const event = await prisma.calendarEvent.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        eventDate: new Date(data.eventDate),
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        type: data.type,
        classId: data.classId ?? null,
        schoolId,
      },
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("Failed to create calendar event:", error);
    return NextResponse.json({ error: "Failed to create calendar event" }, { status: 500 });
  }
}
