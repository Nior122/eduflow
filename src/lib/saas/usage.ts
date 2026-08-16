// ─── Phase 9: usage metering + plan limit checks ─────────────────────
import { prisma } from "@/lib/db";
import type { UsageMetric } from "@prisma/client";
import { currentPeriod, monthsAgoPeriod } from "./api";
import { parsePlanFeatures } from "./plans";

/** Increment a usage counter for the current (or given) period. */
export async function recordUsage(
  schoolId: string,
  metric: UsageMetric,
  amount = 1,
  period = currentPeriod()
) {
  try {
    await prisma.usageRecord.upsert({
      where: { schoolId_metric_period: { schoolId, metric, period } },
      update: { value: { increment: amount } },
      create: { schoolId, metric, period, value: amount },
    });
  } catch (e) {
    // Metering must never break the request it instruments.
    console.error("recordUsage failed:", e);
  }
}

export async function getUsage(
  schoolId: string,
  metric: UsageMetric,
  period = currentPeriod()
): Promise<number> {
  const row = await prisma.usageRecord.findUnique({
    where: { schoolId_metric_period: { schoolId, metric, period } },
    select: { value: true },
  });
  return row?.value ?? 0;
}

/** Returns null when allowed, or the plan limit the action would exceed. */
export async function checkUsageLimit(
  schoolId: string,
  metric: UsageMetric,
  limitKey:
    | "maxStudents"
    | "maxTeachers"
    | "storageMb"
    | "aiTokensPerMonth"
    | "apiCallsPerMonth"
): Promise<number | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      subscription: { select: { plan: { select: { features: true } } } },
    },
  });
  const features = parsePlanFeatures(school?.subscription?.plan?.features);
  const limit = features[limitKey];
  const used = await getUsage(schoolId, metric);
  if (used >= limit) return limit;
  return null;
}

/** Per-period series for the last N months (oldest first). */
export async function usageTrend(schoolId: string, metric: UsageMetric, months = 6) {
  const periods: string[] = [];
  for (let i = months - 1; i >= 0; i--) periods.push(monthsAgoPeriod(i));
  const rows = await prisma.usageRecord.findMany({
    where: { schoolId, metric, period: { in: periods } },
  });
  return periods.map((p) => ({
    period: p,
    value: rows.find((r) => r.period === p)?.value ?? 0,
  }));
}
