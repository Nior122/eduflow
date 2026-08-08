// ─── Phase 5: finance role guards ────────────────────────────────────
import { auth, requireRole } from "@/lib/auth";

export const FINANCE_ROLES = ["FINANCE_OFFICER", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

/** Guard + session + schoolId for finance routes (finance officer + admins). */
export async function financeGuard() {
  const session = await auth();
  const denied = requireRole(session, FINANCE_ROLES, { schoolScoped: true });
  if (denied) return { denied, session, schoolId: null as string | null };
  return { denied: null, session, schoolId: session?.user?.schoolId ?? null };
}
