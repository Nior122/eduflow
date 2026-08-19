import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, aiSettingsSchema } from "@/lib/validations";
import { getAiConfig } from "@/lib/ai/core";
import { aiGuard } from "@/lib/ai/guard";
import { AI_PROVIDER_IDS, AI_PROVIDERS, providerKey } from "@/lib/ai/providers";
import { AI_MODULES } from "@/lib/ai/core";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLES: UserRole[] = ["SCHOOL_ADMIN", "SUPER_ADMIN"];

const DEFAULT_MODULES = Object.fromEntries(AI_MODULES.map((m) => [m, true]));

/** GET /api/ai/settings — current AI configuration + provider availability (admin). */
export async function GET() {
  const guard = await aiGuard({ module: "assistant", roles: ADMIN_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { schoolId } = guard;

  const settings = await prisma.aiSetting.upsert({
    where: { schoolId },
    create: { schoolId },
    update: {},
  });

  const providers = AI_PROVIDER_IDS.map((id) => ({
    id,
    label: AI_PROVIDERS[id].label,
    defaultModel: AI_PROVIDERS[id].defaultModel,
    configured: !!providerKey(id),
  }));

  const cfg = await getAiConfig(schoolId);

  return NextResponse.json({
    settings: {
      provider: settings.provider,
      model: settings.model,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      streamingEnabled: settings.streamingEnabled,
      fallbackProvider: settings.fallbackProvider,
      monthlyBudgetCents: settings.monthlyBudgetCents,
      modulesEnabled: { ...DEFAULT_MODULES, ...((settings.modulesEnabled as Record<string, boolean> | null) ?? {}) },
    },
    activeProviderReady: cfg.providerReady,
    providers,
  });
}

/** PATCH /api/ai/settings — update AI configuration (admin). */
export async function PATCH(req: Request) {
  const guard = await aiGuard({ module: "assistant", roles: ADMIN_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { schoolId } = guard;

  const body = await parseJsonBody(req).catch(() => null);
  const parsed = validate(aiSettingsSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }
  const data = parsed.data;

  const settings = await prisma.aiSetting.upsert({
    where: { schoolId },
    create: {
      schoolId,
      ...(data.provider !== undefined && { provider: data.provider }),
      ...(data.model !== undefined && { model: data.model }),
      ...(data.temperature !== undefined && { temperature: data.temperature }),
      ...(data.maxTokens !== undefined && { maxTokens: data.maxTokens }),
      ...(data.streamingEnabled !== undefined && { streamingEnabled: data.streamingEnabled }),
      ...(data.fallbackProvider !== undefined && { fallbackProvider: data.fallbackProvider }),
      ...(data.monthlyBudgetCents !== undefined && { monthlyBudgetCents: data.monthlyBudgetCents }),
      ...(data.modulesEnabled !== undefined && { modulesEnabled: data.modulesEnabled }),
    },
    update: {
      ...(data.provider !== undefined && { provider: data.provider }),
      ...(data.model !== undefined && { model: data.model }),
      ...(data.temperature !== undefined && { temperature: data.temperature }),
      ...(data.maxTokens !== undefined && { maxTokens: data.maxTokens }),
      ...(data.streamingEnabled !== undefined && { streamingEnabled: data.streamingEnabled }),
      ...(data.fallbackProvider !== undefined && { fallbackProvider: data.fallbackProvider }),
      ...(data.monthlyBudgetCents !== undefined && { monthlyBudgetCents: data.monthlyBudgetCents }),
      ...(data.modulesEnabled !== undefined && { modulesEnabled: data.modulesEnabled }),
    },
  });

  return NextResponse.json({ settings });
}
