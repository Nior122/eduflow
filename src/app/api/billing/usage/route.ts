import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { usageTrend, getUsage } from "@/lib/saas/usage";
import { parsePlanFeatures } from "@/lib/saas/plans";

/**
 * GET /api/billing/usage — current-period usage vs plan limits, plus a
 * 6-month trend for the headline meters. AI usage comes from AiUsageLog
 * (the AI module's own metering) so numbers are exact.
 */
export async function GET() {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const school = await prisma.school.findUnique({
    where: { id: guard.schoolId },
    select: { subscription: { select: { plan: { select: { features: true, code: true } } } } },
  });
  const features = parsePlanFeatures(school?.subscription?.plan?.features);

  const [students, teachers, apiCalls, storageKb, aiTotals] = await Promise.all([
    getUsage(guard.schoolId, "STUDENTS"),
    getUsage(guard.schoolId, "TEACHERS"),
    getUsage(guard.schoolId, "API_CALLS"),
    getUsage(guard.schoolId, "STORAGE_KB"),
    prisma.aiUsageLog.aggregate({
      where: { schoolId: guard.schoolId },
      _sum: { totalTokens: true, costUsd: true },
    }),
  ]);

  const trends = {
    students: await usageTrend(guard.schoolId, "STUDENTS"),
    teachers: await usageTrend(guard.schoolId, "TEACHERS"),
    apiCalls: await usageTrend(guard.schoolId, "API_CALLS"),
  };

  return NextResponse.json({
    planCode: school?.subscription?.plan?.code ?? null,
    limits: {
      maxStudents: features.maxStudents,
      maxTeachers: features.maxTeachers,
      storageMb: features.storageMb,
      aiTokensPerMonth: features.aiTokensPerMonth,
      apiCallsPerMonth: features.apiCallsPerMonth,
    },
    usage: {
      students,
      teachers,
      apiCalls,
      storageKb,
      aiTokens: aiTotals._sum.totalTokens ?? 0,
      aiCostUsd: aiTotals._sum.costUsd ?? 0,
    },
    trends,
  });
}
