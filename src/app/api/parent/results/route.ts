import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const PARENT_ROLES = ["PARENT"] as const;

/** GET /api/parent/results — report cards for all of the parent's children. */
export async function GET() {
  const session = await auth();
  const denied = requireRole(session, PARENT_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const parentId = session?.user?.parentId;
  if (!parentId) return NextResponse.json({ error: "Parent profile not found" }, { status: 404 });

  const children = await prisma.student.findMany({
    where: { parentId, isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      class: { select: { name: true } },
      reportCards: {
        include: { session: true, term: true },
        orderBy: [{ session: { name: "desc" } }, { term: { name: "desc" } }],
      },
    },
    orderBy: { lastName: "asc" },
  });

  return NextResponse.json({
    children: children.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      admissionNumber: c.admissionNumber,
      className: c.class?.name ?? "—",
      reportCards: c.reportCards.map((rc) => ({
        id: rc.id,
        sessionName: rc.session.name,
        termName: rc.term.name,
        overallAverage: Number(rc.overallAverage),
        overallGrade: rc.overallGrade,
        classPosition: rc.classPosition,
        promotionStatus: rc.promotionStatus,
        isPublished: rc.isPublished,
      })),
    })),
  });
}
