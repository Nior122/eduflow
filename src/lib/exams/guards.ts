// ─── Phase 4: shared API guards ──────────────────────────────────────
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth, requireRole } from "@/lib/auth";

export const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;
export const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;
export const ALL_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT"] as const;

/** Guard + schoolId for admin-only routes. */
export async function adminGuard() {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return { denied, session, schoolId: null as string | null };
  return { denied: null, session, schoolId: session?.user?.schoolId ?? null };
}

/** Guard + schoolId for staff (teacher/admin) routes. */
export async function staffGuard() {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return { denied, session, schoolId: null as string | null };
  return { denied: null, session, schoolId: session?.user?.schoolId ?? null };
}

/**
 * A teacher may only enter scores for a class+subject+session+term they
 * are assigned to (TeacherAssignment or ClassSubject); admins pass.
 */
export async function assertTeacherAssignment(opts: {
  teacherId?: string | null;
  role?: string;
  classId: string;
  subjectId: string;
  sessionId: string;
  termId: string;
}): Promise<NextResponse | null> {
  if (!opts.teacherId || (opts.role && opts.role !== "TEACHER")) return null;

  const [assigned, classSubject] = await Promise.all([
    prisma.teacherAssignment.findFirst({
      where: {
        teacherId: opts.teacherId,
        classId: opts.classId,
        subjectId: opts.subjectId,
        AND: [
          { OR: [{ sessionId: opts.sessionId }, { sessionId: null }] },
          { OR: [{ termId: opts.termId }, { termId: null }] },
        ],
      },
    }),
    prisma.classSubject.findFirst({
      where: {
        classId: opts.classId,
        subjectId: opts.subjectId,
        teacherId: opts.teacherId,
      },
    }),
  ]);

  if (!assigned && !classSubject) {
    const { NextResponse } = await import("next/server");
    return NextResponse.json(
      { error: "You are not assigned to teach this class/subject" },
      { status: 403 }
    );
  }
  return null;
}
