// ─── Phase 9: unified API guard — session + role + feature + tenant ──
import { NextResponse } from "next/server";
import type { FeatureModule, UserRole } from "@prisma/client";
import { getTenantSession, requireSchoolContext, type TenantSession } from "./tenant";
import { canUseModule } from "./features";

export interface GuardContext {
  session: TenantSession;
  userId: string;
  role: string;
  /** Non-empty when schoolScoped (or the session carries a schoolId). */
  schoolId: string;
}

/**
 * Guard for Phase 9 API routes. Returns either a `NextResponse` error
 * (401/403) or a `GuardContext` the route can use. All new routes should
 * start with `const guard = await apiGuard({...}); if (guard instanceof
 * NextResponse) return guard;` (same shape as the existing `aiGuard`).
 */
export async function apiGuard(
  opts: {
    roles?: UserRole[];
    feature?: FeatureModule;
    schoolScoped?: boolean;
  } = {}
): Promise<NextResponse | GuardContext> {
  const session = await getTenantSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (opts.roles && !opts.roles.includes(session.role as UserRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (opts.schoolScoped) {
    const denied = requireSchoolContext(session);
    if (denied) return denied;
  }

  if (opts.feature && session.schoolId) {
    const allowed = await canUseModule(session.schoolId, opts.feature);
    if (!allowed) {
      return NextResponse.json(
        { error: "This module is not available on your subscription plan" },
        { status: 403 }
      );
    }
  }

  return {
    session,
    userId: session.userId,
    role: session.role,
    schoolId: session.schoolId ?? "",
  };
}
