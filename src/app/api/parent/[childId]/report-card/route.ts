import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getChildForParent } from "@/lib/portal";

const PARENT_ROLES = ["PARENT"] as const;

type RouteCtx = { params: Promise<{ childId: string }> };

/** GET /api/parent/[childId]/report-card — published report cards + transcript availability. */
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

  const [reportCards, transcript] = await Promise.all([
    prisma.reportCard.findMany({
      where: { studentId: childId, isPublished: true },
      include: {
        session: { select: { name: true } },
        term: { select: { name: true } },
        class: { select: { name: true } },
      },
      orderBy: [{ session: { name: "desc" } }, { term: { name: "desc" } }],
    }),
    prisma.transcript.findUnique({
      where: { studentId: childId },
      select: { lastGeneratedAt: true },
    }),
  ]);

  return NextResponse.json({
    child: { id: child.id, firstName: child.firstName, lastName: child.lastName, className: child.class?.name ?? null },
    reportCards: reportCards.map((rc) => ({
      id: rc.id,
      sessionName: rc.session.name,
      termName: rc.term.name,
      className: rc.class.name,
      overallAverage: Number(rc.overallAverage),
      overallGrade: rc.overallGrade,
      classPosition: rc.classPosition,
      totalStudents: rc.totalStudents,
      promotionStatus: rc.promotionStatus,
      classTeacherComment: rc.classTeacherComment,
      principalComment: rc.principalComment,
      verificationCode: rc.verificationCode,
      publishedAt: rc.publishedAt?.toISOString() ?? null,
    })),
    transcript: transcript ? { lastGeneratedAt: transcript.lastGeneratedAt.toISOString() } : null,
  });
}
