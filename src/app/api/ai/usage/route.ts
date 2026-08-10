import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { budgetRemainingCents } from "@/lib/ai/core";
import { aiGuard } from "@/lib/ai/guard";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLES: UserRole[] = ["SCHOOL_ADMIN", "SUPER_ADMIN"];

/** GET /api/ai/usage — AI usage dashboard (admin): totals, per module, per user, recent logs. */
export async function GET() {
  const guard = await aiGuard({ module: "assistant", roles: ADMIN_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { schoolId } = guard;

  const [totals, byModule, byUser, recent, budget] = await Promise.all([
    prisma.aiUsageLog.aggregate({
      where: { schoolId },
      _count: { _all: true },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costUsd: true },
    }),
    prisma.aiUsageLog.groupBy({
      by: ["module"],
      where: { schoolId },
      _count: { _all: true },
      _sum: { costUsd: true, totalTokens: true },
      orderBy: { _sum: { costUsd: "desc" } },
    }),
    prisma.aiUsageLog.groupBy({
      by: ["userId"],
      where: { schoolId },
      _count: { _all: true },
      _sum: { costUsd: true },
      orderBy: { _sum: { costUsd: "desc" } },
      take: 10,
    }),
    prisma.aiUsageLog.findMany({
      where: { schoolId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    budgetRemainingCents(schoolId),
  ]);

  const userNames = new Map<string, string>();
  if (byUser.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: byUser.map((u) => u.userId) } },
      select: { id: true, name: true },
    });
    for (const u of users) userNames.set(u.id, u.name ?? "Unknown");
  }

  return NextResponse.json({
    totals: {
      calls: totals._count._all,
      promptTokens: totals._sum.promptTokens ?? 0,
      completionTokens: totals._sum.completionTokens ?? 0,
      totalTokens: totals._sum.totalTokens ?? 0,
      costUsd: Math.round((totals._sum.costUsd ?? 0) * 10000) / 10000,
    },
    budgetRemainingCents: budget,
    byModule: byModule.map((m) => ({
      module: m.module,
      calls: m._count._all,
      costUsd: Math.round((m._sum.costUsd ?? 0) * 10000) / 10000,
      totalTokens: m._sum.totalTokens ?? 0,
    })),
    byUser: byUser.map((u) => ({
      userId: u.userId,
      name: userNames.get(u.userId) ?? "Unknown",
      calls: u._count._all,
      costUsd: Math.round((u._sum.costUsd ?? 0) * 10000) / 10000,
    })),
    recent: recent.map((l) => ({
      id: l.id,
      module: l.module,
      provider: l.provider,
      model: l.model,
      totalTokens: l.totalTokens,
      costUsd: Math.round(l.costUsd * 10000) / 10000,
      latencyMs: l.latencyMs,
      status: l.status,
      error: l.error,
      user: l.user.name ?? "Unknown",
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
