import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";

/**
 * GET /api/superadmin/audit?category=&page=&pageSize= — platform audit trail.
 */
export async function GET(req: Request) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10) || 50));

  const where = category && category !== "ALL" ? { category } : {};
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        school: { select: { name: true } },
        actor: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    data: rows,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
