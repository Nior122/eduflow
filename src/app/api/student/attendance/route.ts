import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { attendanceRate } from "@/lib/portal";

const STUDENT_ROLES = ["STUDENT"] as const;

/** GET /api/student/attendance — the student's own attendance history. */
export async function GET() {
  const session = await auth();
  const denied = requireRole(session, STUDENT_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const studentId = session?.user?.studentId;
  if (!studentId) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

  const records = await prisma.attendance.findMany({
    where: { studentId },
    orderBy: { date: "desc" },
    take: 90,
    select: { id: true, date: true, status: true },
  });

  const byStatus = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    rate: attendanceRate(records),
    records: records.map((r) => ({ id: r.id, date: r.date.toISOString(), status: r.status })),
    byStatus,
  });
}
