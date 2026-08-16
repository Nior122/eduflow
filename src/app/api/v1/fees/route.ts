import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardV1ApiKey } from "@/lib/saas/v1";
import { parsePagination, paginated } from "@/lib/saas/api";

const SAFE_SORTS = ["createdAt", "name", "amount"];

/** GET /api/v1/fees — fee types configured by the school. */
export async function GET(req: Request) {
  const auth = await guardV1ApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const { page, pageSize, skip, take, sort, order } = parsePagination(searchParams, { page: 1, pageSize: 100, max: 500 });
  const safeSort = SAFE_SORTS.includes(sort) ? sort : "createdAt";

  const where: Record<string, unknown> = { schoolId: auth.schoolId };
  const isActive = searchParams.get("isActive");
  if (isActive === "true") where.isActive = true;
  else if (isActive === "false") where.isActive = false;

  const [rows, total] = await Promise.all([
    prisma.fee.findMany({
      where,
      orderBy: { [safeSort]: order },
      skip,
      take,
      select: {
        id: true,
        name: true,
        description: true,
        amount: true,
        dueDate: true,
        isOptional: true,
        isRecurring: true,
        term: true,
        session: true,
        isActive: true,
        createdAt: true,
        feeCategory: { select: { name: true } },
        class: { select: { name: true } },
      },
    }),
    prisma.fee.count({ where }),
  ]);

  return NextResponse.json(paginated(rows, total, page, pageSize));
}
