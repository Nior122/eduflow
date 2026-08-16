import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deliverDueWebhooks } from "@/lib/saas/webhooks";
import { sendAlert } from "@/lib/saas/alerts";
import { logger } from "@/lib/saas/logger";
import { audit } from "@/lib/saas/audit";

/**
 * /api/cron/daily — scheduled maintenance (Vercel Cron, 03:00 UTC daily).
 * Protected by CRON_SECRET bearer token. Tasks:
 *  1. Expire ended trials (TRIALING → EXPIRED).
 *  2. Downgrade long-past-due subscriptions (PAST_DUE → EXPIRED after 30d).
 *  3. Mark overdue platform invoices (OPEN + dueDate past by 7d → OVERDUE).
 *  4. Retry due outbound webhooks.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  return Boolean(secret && auth === `Bearer ${secret}`);
}

async function run(): Promise<Record<string, unknown>> {
  const now = new Date();
  const results: Record<string, unknown> = {};

  // 1. Trials that ended without payment.
  const expiredTrials = await prisma.subscription.updateMany({
    where: { status: "TRIALING", trialEndsAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  results.expiredTrials = expiredTrials.count;

  // 2. Past-due for more than 30 days.
  const graceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const expiredPastDue = await prisma.subscription.updateMany({
    where: { status: "PAST_DUE", updatedAt: { lte: graceDate } },
    data: { status: "EXPIRED" },
  });
  results.expiredPastDue = expiredPastDue.count;

  // 3. Overdue invoices (unpaid 7 days past due date).
  const overdueCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const overdueInvoices = await prisma.billingInvoice.updateMany({
    where: { status: "OPEN", dueDate: { lte: overdueCutoff } },
    data: { status: "OVERDUE" },
  });
  results.overdueInvoices = overdueInvoices.count;

  // 4. Webhook retries.
  results.webhooksDelivered = await deliverDueWebhooks(now);

  if ((results.expiredTrials as number) > 0 || (results.expiredPastDue as number) > 0) {
    await sendAlert({
      title: "Daily cron: subscriptions expired",
      message: `${String(results.expiredTrials)} trials, ${String(results.expiredPastDue)} past-due subscriptions expired.`,
      level: "warn",
    });
  }

  await audit({
    action: "CRON_DAILY",
    category: "ADMIN",
    metadata: results,
  });
  logger.info("daily cron complete", results);
  return results;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}
