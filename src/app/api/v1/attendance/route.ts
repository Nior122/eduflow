import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardV1ApiKey } from "@/lib/saas/v1";
import { parsePagination, paginated } from "@/lib/saas/api";

/**
 * GET /api/v1/attendance — attendance rows, tenant-scoped through the
 * student's school. Filters: date (YYYY-MM-DD), classId, studentId, status.
 */
export async function GET(req: Request) {
  const auth = await guardV1ApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const { page, pageSize, skip, take } = parsePagination(searchParams, { page: 1, pageSize: 100, max: 500 });

  const where: Record<string, unknown> = { student: { schoolId: auth.schoolId } };
  const date = searchParams.get("date");
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    where.date = { gte: start, lte: end };
  }
  const classId = searchParams.get("classId");
  if (classId) where.classId = classId;
  const studentId = searchParams.get("studentId");
  if (studentId) where.studentId = studentId;
  const status = searchParams.get("status");
  if (status) where.status = status;

  const [rows, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take,
      select: {
        id: true,
        date: true,
        status: true,
        remark: true,
        studentId: true,
        classId: true,
        subjectId: true,
        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        class: { select: { name: true } },
      },
    }),
    prisma.attendance.count({ where }),
  ]);

  return NextResponse.json(paginated(rows, total, page, pageSize));
}
