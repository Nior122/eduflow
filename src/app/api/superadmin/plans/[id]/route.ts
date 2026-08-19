import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";

/**
 * PATCH /api/superadmin/plans/[id] — { isActive } | full plan fields.
 * DELETE — hard-delete (only when no subscriptions reference it).
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;
  const { id } = await ctx.params;

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const body = await parseJsonBody(req).catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string") data.name = body.name;
  if (typeof body?.description === "string") data.description = body.description;
  if (typeof body?.priceMonthly === "number") data.priceMonthly = body.priceMonthly;
  if (typeof body?.priceYearly === "number") data.priceYearly = body.priceYearly;
  if (typeof body?.currency === "string") data.currency = body.currency;
  if (body?.features !== undefined) data.features = body.features;
  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body?.sortOrder === "number") data.sortOrder = body.sortOrder;

  await prisma.subscriptionPlan.update({ where: { id }, data });
  await audit({
    actorId: guard.userId,
    action: "PLAN_UPDATED",
    category: "ADMIN",
    metadata: { code: plan.code },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;
  const { id } = await ctx.params;

  const subs = await prisma.subscription.count({ where: { planId: id } });
  if (subs > 0) {
    return NextResponse.json(
      { error: "Plan is in use by subscriptions — deactivate it instead" },
      { status: 409 }
    );
  }
  await prisma.subscriptionPlan.delete({ where: { id } });
  await audit({ actorId: guard.userId, action: "PLAN_DELETED", category: "ADMIN" });
  return NextResponse.json({ ok: true });
}
