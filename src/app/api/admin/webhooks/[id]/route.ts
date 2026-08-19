import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";

/**
 * PATCH /api/admin/webhooks/[id] — pause/resume or rename.
 * DELETE /api/admin/webhooks/[id] — remove endpoint.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;
  const { id } = await ctx.params;

  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id, schoolId: guard.schoolId },
  });
  if (!existing) return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });

  const body = await parseJsonBody(req).catch(() => null);
  await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      ...(typeof body?.isActive === "boolean" ? { isActive: body.isActive } : {}),
      ...(typeof body?.url === "string" && body.url ? { url: body.url } : {}),
      ...(Array.isArray(body?.events) ? { events: body.events.filter((e: unknown) => typeof e === "string") } : {}),
    },
  });
  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "WEBHOOK_UPDATED",
    category: "ADMIN",
    metadata: { endpointId: id },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;
  const { id } = await ctx.params;

  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id, schoolId: guard.schoolId },
  });
  if (!existing) return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });

  await prisma.webhookEndpoint.delete({ where: { id } });
  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "WEBHOOK_DELETED",
    category: "ADMIN",
    metadata: { endpointId: id },
  });
  return NextResponse.json({ ok: true });
}
