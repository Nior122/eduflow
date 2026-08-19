import { NextResponse } from "next/server";
import { validate, aiSettingsTestSchema } from "@/lib/validations";
import { complete, providerKey, resolveModel } from "@/lib/ai/providers";
import { aiGuard } from "@/lib/ai/guard";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLES: UserRole[] = ["SCHOOL_ADMIN", "SUPER_ADMIN"];

/**
 * POST /api/ai/settings/test — verify a provider key with a tiny
 * completion. Never returns the key itself.
 */
export async function POST(req: Request) {
  const guard = await aiGuard({ module: "assistant", roles: ADMIN_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;

  const body = await parseJsonBody(req).catch(() => null);
  const parsed = validate(aiSettingsTestSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }
  const provider = parsed.data.provider ?? guard.config.provider;
  const key = providerKey(provider);
  if (!key) {
    return NextResponse.json(
      { ok: false, error: `No API key configured for ${provider}. Set the environment variable and redeploy.` },
      { status: 200 }
    );
  }

  const model = resolveModel(provider, parsed.data.model ?? guard.config.model);
  const started = Date.now();
  try {
    const result = await complete({
      provider,
      model,
      temperature: 0,
      maxTokens: 16,
      messages: [{ role: "user", content: "Reply with the single word OK." }],
    });
    return NextResponse.json({
      ok: true,
      provider,
      model,
      latencyMs: Date.now() - started,
      sample: result.text.slice(0, 120),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      provider,
      model,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Test failed",
    });
  }
}
