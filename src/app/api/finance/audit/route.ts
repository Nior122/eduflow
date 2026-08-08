import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { financeGuard } from "@/lib/finance/guards";
import { Prisma } from "@prisma/client";

/**
 * GET /api/finance/audit — complete financial audit trail.
 * ?entity&action&from&to&search (actor name / entity id)
 */
export async function GET(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity");
  const action = searchParams.get("action");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search");

  const where: Prisma.FinanceAuditLogWhereInput = { actor: { schoolId } };
  if (entity) where.entity = entity;
  if (action) where.action = action;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
    };
  }
  if (search) {
    where.OR = [
      { entityId: { contains: search, mode: "insensitive" } },
      { actor: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const logs = await prisma.financeAuditLog.findMany({
    where,
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ logs });
}
