import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getChildForParent } from "@/lib/portal";

const PARENT_ROLES = ["PARENT"] as const;

type RouteCtx = { params: Promise<{ childId: string }> };

/** GET /api/parent/[childId]/calendar — upcoming school/class events + exams for one child. */
export async function GET(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, PARENT_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const parentId = session?.user?.parentId;
  const schoolId = session?.user?.schoolId;
  if (!parentId || !schoolId) {
    return NextResponse.json({ error: "Parent profile not found" }, { status: 404 });
  }

  const { childId } = await params;
  const child = await getChildForParent(parentId, schoolId, childId);
  if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [events, exams] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        schoolId,
        eventDate: { gte: today },
        ...(child.classId ? { OR: [{ classId: null }, { classId: child.classId }] } : {}),
      },
      orderBy: { eventDate: "asc" },
      take: 20,
    }),
    prisma.examination.findMany({
      where: {
        schoolId,
        status: "ACTIVE",
        endDate: { gte: today },
        ...(child.classId ? { classes: { some: { classId: child.classId } } } : {}),
      },
      include: {
        session: { select: { name: true } },
        term: { select: { name: true } },
      },
      orderBy: { startDate: "asc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    child: { id: child.id, firstName: child.firstName, lastName: child.lastName, className: child.class?.name ?? null },
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      type: e.type,
      eventDate: e.eventDate.toISOString(),
      startTime: e.startTime,
      endTime: e.endTime,
    })),
    exams: exams.map((x) => ({
      id: x.id,
      name: x.name,
      type: x.type,
      startDate: x.startDate?.toISOString() ?? null,
      endDate: x.endDate?.toISOString() ?? null,
      sessionName: x.session.name,
      termName: x.term.name,
    })),
  });
}
