import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getChildForParent } from "@/lib/portal";

const PARENT_ROLES = ["PARENT"] as const;

type RouteCtx = { params: Promise<{ childId: string }> };

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/** GET /api/parent/[childId]/timetable — weekly timetable for one child's class. */
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

  if (!child.classId) {
    return NextResponse.json({ child: { id: child.id, firstName: child.firstName, lastName: child.lastName, className: null }, days: [] });
  }

  const entries = await prisma.timetableEntry.findMany({
    where: { schoolId, classId: child.classId },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });

  const days = DAYS.map((day) => ({
    day,
    entries: entries
      .filter((e) => e.day === day)
      .map((e) => ({
        id: e.id,
        startTime: e.startTime,
        endTime: e.endTime,
        subject: e.subject.name,
        teacher: e.teacher ? `${e.teacher.firstName} ${e.teacher.lastName}` : null,
      })),
  })).filter((d) => d.entries.length > 0);

  return NextResponse.json({
    child: { id: child.id, firstName: child.firstName, lastName: child.lastName, className: child.class?.name ?? null },
    days,
  });
}
