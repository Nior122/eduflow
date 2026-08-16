// ─── Phase 9: outbound webhook delivery (HMAC-signed, retried) ───────
import { createHmac } from "crypto";
import { prisma } from "@/lib/db";

export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Queue an event for every matching active endpoint of the school. */
export async function queueWebhookEvent(input: {
  schoolId: string;
  event: string;
  payload: unknown;
}) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { schoolId: input.schoolId, isActive: true },
  });
  for (const ep of endpoints) {
    if (ep.events.length > 0 && !ep.events.includes(input.event)) continue;
    await prisma.webhookEventLog.create({
      data: {
        schoolId: input.schoolId,
        endpointId: ep.id,
        event: input.event,
        payload: input.payload as object,
        status: "PENDING",
        nextAttemptAt: new Date(),
      },
    });
  }
}

/** Deliver due webhook events (called by the daily cron). Returns count. */
export async function deliverDueWebhooks(now = new Date(), limit = 20): Promise<number> {
  const due = await prisma.webhookEventLog.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now }, attempts: { lt: 5 } },
    take: limit,
    include: { endpoint: true },
    orderBy: { createdAt: "asc" },
  });
  let delivered = 0;
  for (const ev of due) {
    if (!ev.endpoint) continue;
    const body = JSON.stringify({
      id: ev.id,
      event: ev.event,
      createdAt: ev.createdAt,
      data: ev.payload,
    });
    const secret = ev.endpoint.secret ?? "";
    try {
      const res = await fetch(ev.endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EduFlow-Event": ev.event,
          "X-EduFlow-Signature": secret ? signPayload(secret, body) : "",
          "X-EduFlow-Idempotency-Key": ev.id,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        await prisma.webhookEventLog.update({
          where: { id: ev.id },
          data: { status: "DELIVERED", deliveredAt: new Date(), responseStatus: res.status },
        });
        delivered++;
      } else {
        await prisma.webhookEventLog.update({
          where: { id: ev.id },
          data: {
            attempts: { increment: 1 },
            responseStatus: res.status,
            nextAttemptAt: new Date(Date.now() + 5 * 60 * 1000 * 2 ** ev.attempts),
          },
        });
      }
    } catch {
      await prisma.webhookEventLog.update({
        where: { id: ev.id },
        data: {
          attempts: { increment: 1 },
          nextAttemptAt: new Date(Date.now() + 5 * 60 * 1000 * 2 ** ev.attempts),
        },
      });
    }
  }
  return delivered;
}
