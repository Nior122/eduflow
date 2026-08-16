// ─── Phase 9: tenant context + isolation helpers ─────────────────────
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export interface TenantSession {
  userId: string;
  role: string;
  schoolId: string | null;
}

export async function getTenantSession(): Promise<TenantSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    role: session.user.role,
    schoolId: session.user.schoolId ?? null,
  };
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN";
}

/** 401/403 unless the session may operate on `targetSchoolId`. */
export function assertTenantAccess(
  session: TenantSession | null,
  targetSchoolId: string | undefined | null
): NextResponse | null {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!targetSchoolId) {
    return NextResponse.json({ error: "Forbidden: missing school context" }, { status: 403 });
  }
  if (isSuperAdmin(session.role)) return null;
  if (session.schoolId !== targetSchoolId) {
    return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
  }
  return null;
}

/** 401/403 unless the session belongs to a school. */
export function requireSchoolContext(session: TenantSession | null): NextResponse | null {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.schoolId) {
    return NextResponse.json({ error: "Forbidden: no school context" }, { status: 403 });
  }
  return null;
}
