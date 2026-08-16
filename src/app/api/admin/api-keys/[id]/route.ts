import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";

/**
 * PATCH /api/admin/api-keys/[id] — toggle active / update name.
 * DELETE /api/admin/api-keys/[id] — revoke.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;
  const { id } = await ctx.params;

  const existing = await prisma.apiKey.findFirst({
    where: { id, schoolId: guard.schoolId },
  });
  if (!existing) return NextResponse.json({ error: "API key not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  await prisma.apiKey.update({
    where: { id },
    data: {
      ...(typeof body?.name === "string" && body.name ? { name: body.name } : {}),
      ...(typeof body?.isActive === "boolean" ? { isActive: body.isActive } : {}),
    },
  });
  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "API_KEY_UPDATED",
    category: "ADMIN",
    metadata: { keyId: id },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;
  const { id } = await ctx.params;

  const existing = await prisma.apiKey.findFirst({
    where: { id, schoolId: guard.schoolId },
  });
  if (!existing) return NextResponse.json({ error: "API key not found" }, { status: 404 });

  await prisma.apiKey.delete({ where: { id } });
  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "API_KEY_REVOKED",
    category: "ADMIN",
    metadata: { keyId: id },
  });
  return NextResponse.json({ ok: true });
}
