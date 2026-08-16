import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardV1ApiKey } from "@/lib/saas/v1";
import { parsePagination, paginated } from "@/lib/saas/api";

const SAFE_SORTS = ["createdAt", "updatedAt"];

/**
 * GET /api/v1/results — published result rows for the school.
 * Filters: studentId, classId, subjectId, term, session, status.
 */
export async function GET(req: Request) {
  const auth = await guardV1ApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const { page, pageSize, skip, take, sort, order } = parsePagination(searchParams, { page: 1, pageSize: 100, max: 500 });
  const safeSort = SAFE_SORTS.includes(sort) ? sort : "updatedAt";

  const where: Record<string, unknown> = { student: { schoolId: auth.schoolId } };
  const studentId = searchParams.get("studentId");
  if (studentId) where.studentId = studentId;
  const classId = searchParams.get("classId");
  if (classId) where.classId = classId;
  const subjectId = searchParams.get("subjectId");
  if (subjectId) where.subjectId = subjectId;
  const term = searchParams.get("term");
  if (term) where.term = term;
  const session = searchParams.get("session");
  if (session) where.session = session;
  const status = searchParams.get("status");
  if (status) where.status = status;

  const [rows, total] = await Promise.all([
    prisma.result.findMany({
      where,
      orderBy: { [safeSort]: order },
      skip,
      take,
      select: {
        id: true,
        studentId: true,
        classId: true,
        subjectId: true,
        term: true,
        session: true,
        assignment: true,
        test: true,
        exam: true,
        total: true,
        percentage: true,
        grade: true,
        remark: true,
        status: true,
        updatedAt: true,
        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        subject: { select: { name: true, code: true } },
        class: { select: { name: true } },
      },
    }),
    prisma.result.count({ where }),
  ]);

  return NextResponse.json(paginated(rows, total, page, pageSize));
}
