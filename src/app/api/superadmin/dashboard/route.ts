import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { currentPeriod } from "@/lib/saas/api";

/**
 * GET /api/superadmin/dashboard — platform KPIs: schools, revenue,
 * subscriptions, active users, usage, tickets, health, recent signups.
 */
export async function GET() {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const period = currentPeriod();

  const [totalSchools, newSchools, statusGroups, activeSubs, totalUsers, storageRows, aiTotals, openTickets, recentSchools, dbPing] =
    await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.subscription.findMany({ where: { status: "ACTIVE" }, select: { amountMinor: true, currency: true } }),
      prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
      prisma.usageRecord.findMany({ where: { period, metric: "STORAGE_KB" }, select: { value: true } }),
      prisma.aiUsageLog.aggregate({ _sum: { totalTokens: true, costUsd: true } }),
      prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }),
      prisma.school.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, slug: true, createdAt: true } }),
      prisma.$queryRaw`SELECT 1 AS ok`.catch(() => null),
    ]);

  const mrrMinor = activeSubs.reduce((acc, s) => acc + s.amountMinor, 0);
  const storageMb = Math.round(storageRows.reduce((acc, r) => acc + r.value, 0) / 1024);

  return NextResponse.json({
    stats: {
      totalSchools,
      newSchools,
      activeSubscriptions: statusGroups.find((g) => g.status === "ACTIVE")?._count._all ?? 0,
      trialing: statusGroups.find((g) => g.status === "TRIALING")?._count._all ?? 0,
      pastDue: statusGroups.find((g) => g.status === "PAST_DUE")?._count._all ?? 0,
      canceled: statusGroups.find((g) => g.status === "CANCELED")?._count._all ?? 0,
      mrrMinor,
      totalUsers,
      storageMb,
      aiTokens: aiTotals._sum.totalTokens ?? 0,
      aiCostUsd: aiTotals._sum.costUsd ?? 0,
      openTickets,
      dbHealthy: dbPing !== null,
    },
    recentSchools,
  });
}
