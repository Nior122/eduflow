// ─── Phase 9: v1 API key auth + helpers ──────────────────────────────
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashApiKey, isValidApiKeyFormat } from "./apikeys";
import { rateLimit, ipKey } from "@/lib/rate-limit";
import { recordUsage } from "./usage";

export interface V1Context {
  schoolId: string;
  keyId: string;
  keyName: string;
}

/** Authenticate an /api/v1 request via `x-api-key`. */
export async function guardV1ApiKey(req: Request): Promise<NextResponse | V1Context> {
  const key = req.headers.get("x-api-key");
  if (!key || !isValidApiKeyFormat(key)) {
    return NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(ipKey(ip, "v1"), { limit: 120, windowMs: 60 * 1000 })) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const row = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
  if (!row || !row.isActive) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }
  if (row.expiresAt && row.expiresAt < new Date()) {
    return NextResponse.json({ error: "API key expired" }, { status: 401 });
  }
  await prisma.apiKey.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });
  await recordUsage(row.schoolId, "API_CALLS", 1);
  return { schoolId: row.schoolId, keyId: row.id, keyName: row.name };
}
