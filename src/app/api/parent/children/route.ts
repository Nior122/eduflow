import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { attendanceRate, averageScore } from "@/lib/portal";

const PARENT_ROLES = ["PARENT"] as const;

/** GET /api/parent/children — every child of the signed-in parent with a live summary. */
export async function GET() {
  const session = await auth();
  const denied = requireRole(session, PARENT_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const parentId = session?.user?.parentId;
  const schoolId = session?.user?.schoolId;
  if (!parentId || !schoolId) {
    return NextResponse.json({ error: "Parent profile not found" }, { status: 404 });
  }

  const children = await prisma.student.findMany({
    where: { parentId, schoolId, isActive: true },
    include: {
      class: { select: { id: true, name: true } },
      attendances: { select: { status: true }, take: 90 },
      results: { select: { total: true, status: true }, take: 200 },
      feeRecords: { select: { amount: true, status: true } },
    },
    orderBy: { lastName: "asc" },
  });

  return NextResponse.json({
    children: children.map((c) => {
      const feeBalance = c.feeRecords
        .filter((f) => !["PAID", "WAIVED"].includes(f.status))
        .reduce((sum, f) => sum + Number(f.amount), 0);
      const unpaidCount = c.feeRecords.filter((f) => !["PAID", "WAIVED"].includes(f.status)).length;
      const publishedTotals = c.results
        .filter((r) => ["PUBLISHED", "LOCKED"].includes(r.status))
        .map((r) => (r.total == null ? null : Number(r.total)));
      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        admissionNumber: c.admissionNumber,
        gender: c.gender,
        className: c.class?.name ?? "—",
        classId: c.class?.id ?? null,
        attendanceRate: attendanceRate(c.attendances),
        averageScore: averageScore(publishedTotals),
        feeBalance,
        unpaidCount,
      };
    }),
  });
}
