import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getChildForParent } from "@/lib/portal";

const PARENT_ROLES = ["PARENT"] as const;

type RouteCtx = { params: Promise<{ childId: string }> };

/** GET /api/parent/[childId]/schoolwork — assignments & homework for one child's class. */
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
    return NextResponse.json({ child: { id: child.id, firstName: child.firstName, lastName: child.lastName, className: null }, assignments: [], homework: [] });
  }

  const [assignments, homework] = await Promise.all([
    prisma.assignment.findMany({
      where: { schoolId, classId: child.classId },
      include: {
        subject: { select: { name: true } },
        submissions: {
          where: { studentId: childId },
          select: { id: true, submittedAt: true, grade: true, feedback: true },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    prisma.homework.findMany({
      where: { schoolId, classId: child.classId },
      include: {
        subject: { select: { name: true } },
        submissions: {
          where: { studentId: childId },
          select: { id: true, submittedAt: true, grade: true, feedback: true },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
  ]);

  const mapWork = (w: { id: string; title: string; description: string | null; dueDate: Date; subject: { name: string }; submissions: { id: string; submittedAt: Date; grade: number | null; feedback: string | null }[] }) => ({
    id: w.id,
    title: w.title,
    description: w.description,
    dueDate: w.dueDate.toISOString(),
    subject: w.subject.name,
    submission: w.submissions[0]
      ? {
          id: w.submissions[0].id,
          submittedAt: w.submissions[0].submittedAt.toISOString(),
          grade: w.submissions[0].grade,
          feedback: w.submissions[0].feedback,
        }
      : null,
  });

  return NextResponse.json({
    child: { id: child.id, firstName: child.firstName, lastName: child.lastName, className: child.class?.name ?? null },
    assignments: assignments.map(mapWork),
    homework: homework.map(mapWork),
  });
}
