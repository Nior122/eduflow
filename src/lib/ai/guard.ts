/**
 * EduFlow AI — request guard (Phase 7).
 * Central auth + role + rate-limit + module toggle + budget check for
 * AI generation endpoints.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { budgetRemainingCents, getAiConfig, moduleEnabled, type AiRuntimeConfig } from "./core";
import type { UserRole } from "@prisma/client";

export type AiGuardOk = {
  session: NonNullable<Awaited<ReturnType<typeof auth>>>;
  schoolId: string;
  userId: string;
  config: AiRuntimeConfig;
};

export async function aiGuard(opts: {
  module: string;
  roles?: readonly UserRole[];
  budgetCheck?: boolean;
}): Promise<AiGuardOk | NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const schoolId = session.user.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (opts.roles && !opts.roles.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!rateLimit(`ai:${session.user.id}`, { limit: 80, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many AI requests. Please try again later." }, { status: 429 });
  }
  if (!(await moduleEnabled(schoolId, opts.module))) {
    return NextResponse.json({ error: "This AI feature is disabled by your school." }, { status: 403 });
  }
  const config = await getAiConfig(schoolId);
  if (!config.providerReady) {
    return NextResponse.json(
      { error: "AI provider is not configured. An administrator must add a provider API key (see AI Settings)." },
      { status: 503 }
    );
  }
  if (opts.budgetCheck !== false && (await budgetRemainingCents(schoolId)) <= 0) {
    return NextResponse.json({ error: "The school's monthly AI budget has been reached." }, { status: 402 });
  }

  return { session, schoolId, userId: session.user.id, config };
}
