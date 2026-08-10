import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/ai/students?q= — role-scoped student picker with a real
 * performance summary, used by the report comment, parent communication,
 * risk and performance modules.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const schoolId = session.user.schoolId;
  const role = session.user.role;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  const where = {
    schoolId,
    isActive: true as const,
    ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" as const } }, { lastName: { contains: q, mode: "insensitive" as const } }] } : {}),
  };

  let students: { id: string; firstName: string; lastName: string; admissionNumber: string; class: { name: string } | null; attendances: { status: string }[]; results: { total: unknown }[] }[] = [];

  if (role === "STUDENT") {
    if (!session.user.studentId) return NextResponse.json({ students: [] });
    students = await prisma.student.findMany({
      where: { ...where, id: session.user.studentId },
      include: {
        class: { select: { name: true } },
        attendances: { select: { status: true }, take: 90 },
        results: { where: { status: { in: ["PUBLISHED", "LOCKED"] } }, select: { total: true }, take: 100 },
      },
      take: 1,
    });
  } else if (role === "PARENT") {
    if (!session.user.parentId) return NextResponse.json({ students: [] });
    students = await prisma.student.findMany({
      where: { ...where, parentId: session.user.parentId },
      include: {
        class: { select: { name: true } },
        attendances: { select: { status: true }, take: 90 },
        results: { where: { status: { in: ["PUBLISHED", "LOCKED"] } }, select: { total: true }, take: 100 },
      },
      take: 50,
    });
  } else if (role === "TEACHER" && session.user.teacherId) {
    const classSubjects = await prisma.classSubject.findMany({
      where: { teacherId: session.user.teacherId },
      select: { classId: true },
    });
    const classIds = [...new Set(classSubjects.map((c) => c.classId))];
    students = await prisma.student.findMany({
      where: { ...where, classId: { in: classIds } },
      include: {
        class: { select: { name: true } },
        attendances: { select: { status: true }, take: 90 },
        results: { where: { status: { in: ["PUBLISHED", "LOCKED"] } }, select: { total: true }, take: 100 },
      },
      take: 300,
    });
  } else {
    students = await prisma.student.findMany({
      where,
      include: {
        class: { select: { name: true } },
        attendances: { select: { status: true }, take: 90 },
        results: { where: { status: { in: ["PUBLISHED", "LOCKED"] } }, select: { total: true }, take: 100 },
      },
      take: 200,
    });
  }

  const out = students.map((s) => {
    const total = s.attendances.length;
    const present = s.attendances.filter((a) => a.status === "PRESENT").length;
    const totals = s.results.map((r) => Number(r.total ?? 0)).filter((n) => !Number.isNaN(n));
    const avg = totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null;
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      admissionNumber: s.admissionNumber,
      className: s.class?.name ?? null,
      attendanceRate: total ? Math.round((present / total) * 100) : null,
      averageScore: avg,
    };
  });

  return NextResponse.json({ students: out });
}
