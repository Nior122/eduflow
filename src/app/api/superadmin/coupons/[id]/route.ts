import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";

/** PATCH — update coupon (isActive etc). DELETE — remove coupon. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body?.description === "string") data.description = body.description;
  if (typeof body?.maxRedemptions === "number") data.maxRedemptions = body.maxRedemptions;
  if (body?.validUntil) data.validUntil = new Date(String(body.validUntil));

  await prisma.coupon.update({ where: { id }, data });
  await audit({ actorId: guard.userId, action: "COUPON_UPDATED", category: "ADMIN", metadata: { id } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;
  const { id } = await ctx.params;
  await prisma.coupon.delete({ where: { id } });
  await audit({ actorId: guard.userId, action: "COUPON_DELETED", category: "ADMIN", metadata: { id } });
  return NextResponse.json({ ok: true });
}
