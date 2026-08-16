import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";
import { queueWebhookEvent } from "@/lib/saas/webhooks";

/**
 * GET /api/admin/webhooks — list endpoints.
 * POST /api/admin/webhooks — create { url, secret?, events[] }.
 */
export async function GET() {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { schoolId: guard.schoolId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ endpoints });
}

export async function POST(req: Request) {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : null;
  if (!url || !/^https:\/\//.test(url)) {
    return NextResponse.json({ error: "url must be an https URL" }, { status: 400 });
  }
  const events: string[] = Array.isArray(body?.events)
    ? body.events.filter((e: unknown) => typeof e === "string")
    : [];
  const secret = typeof body?.secret === "string" && body.secret ? body.secret : null;

  const endpoint = await prisma.webhookEndpoint.create({
    data: { schoolId: guard.schoolId, url, secret, events },
  });

  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "WEBHOOK_CREATED",
    category: "ADMIN",
    metadata: { endpointId: endpoint.id, url },
  });

  // Ping the endpoint so the school can verify delivery immediately.
  await queueWebhookEvent({
    schoolId: guard.schoolId,
    event: "endpoint.verified",
    payload: { endpointId: endpoint.id, message: "Webhook endpoint registered" },
  });

  return NextResponse.json({ endpoint }, { status: 201 });
}
