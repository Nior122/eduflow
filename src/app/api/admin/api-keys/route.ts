import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { generateApiKey } from "@/lib/saas/apikeys";
import { audit } from "@/lib/saas/audit";

/**
 * GET /api/admin/api-keys — list keys (hashes only, never plaintext).
 * POST /api/admin/api-keys — create { name, expiresAt? } → returns the
 * plaintext key exactly once.
 */
export async function GET() {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;
  const keys = await prisma.apiKey.findMany({
    where: { schoolId: guard.schoolId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : null;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { key, prefix, keyHash } = generateApiKey();
  const expiresAt = body?.expiresAt ? new Date(String(body.expiresAt)) : null;
  const scopes: string[] = Array.isArray(body?.scopes) ? body.scopes.filter((s: unknown) => typeof s === "string") : [];

  const row = await prisma.apiKey.create({
    data: { schoolId: guard.schoolId, name, prefix, keyHash, scopes, expiresAt },
    select: { id: true, name: true, prefix: true, expiresAt: true },
  });

  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "API_KEY_CREATED",
    category: "ADMIN",
    metadata: { keyId: row.id, name: row.name },
  });

  return NextResponse.json({ key: row, apiKey: key }, { status: 201 });
}
