import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardV1ApiKey } from "@/lib/saas/v1";
import { parsePagination, paginated } from "@/lib/saas/api";

const SAFE_SORTS = ["createdAt", "name"];

/** GET /api/v1/classes — paginated list of classes (with class subjects). */
export async function GET(req: Request) {
  const auth = await guardV1ApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const { page, pageSize, skip, take, sort, order } = parsePagination(searchParams);
  const safeSort = SAFE_SORTS.includes(sort) ? sort : "createdAt";
  const where: Record<string, unknown> = { schoolId: auth.schoolId, isActive: true };

  const category = searchParams.get("category");
  if (category) where.category = category;

  const [rows, total] = await Promise.all([
    prisma.class.findMany({
      where,
      orderBy: { [safeSort]: order },
      skip,
      take,
      select: {
        id: true,
        name: true,
        category: true,
        section: true,
        capacity: true,
        _count: { select: { students: true, classSubjects: true } },
        classSubjects: { select: { subject: { select: { id: true, name: true } } } },
      },
    }),
    prisma.class.count({ where }),
  ]);

  return NextResponse.json(paginated(rows, total, page, pageSize));
}
