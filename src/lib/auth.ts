import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import type { UserRole } from "@prisma/client";
import type { Session } from "next-auth";

import { logActivity } from "@/lib/notifications";
import { authConfig } from "./auth.config";

const nextAuth = NextAuth({
  ...authConfig,
  events: {
    async signIn({ user }) {
      if (user?.id) {
        await logActivity({ userId: user.id, action: "LOGIN", entityType: "User" });
      }
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            school: true,
            student: true,
            teacher: true,
            parent: true,
          },
        });

        if (!user || !user.passwordHash) return null;
        if (!user.isActive) return null;

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) return null;

        const sessionData: Record<string, unknown> = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.schoolId,
          image: user.image,
        };

        if (user.student) sessionData.studentId = user.student.id;
        if (user.teacher) sessionData.teacherId = user.teacher.id;
        if (user.parent) sessionData.parentId = user.parent.id;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          schoolId: user.schoolId,
          ...sessionData,
        };
      },
    }),
  ],
});

export const { handlers, signIn, signOut } = nextAuth;

/**
 * next-auth 5 beta ships `auth` with overloads that also match Next.js
 * middleware handlers, which breaks `await auth()` in route handlers
 * (the awaited result union-typed with AppRouteHandlerFn). Export a
 * narrowed, session-returning wrapper so every route typechecks.
 */
export const auth = nextAuth.auth as unknown as () => Promise<Session | null>;

/**
 * Middleware variant of `auth` (NextAuth v5 wrapper used by
 * src/middleware.ts) — accepts a handler receiving { req, auth }.
 */
export const authMiddleware = nextAuth.auth as unknown as (
  handler: (req: Parameters<Parameters<typeof nextAuth.auth>[0]>[0] & { auth: Session | null }) => unknown
) => (req: unknown) => unknown;

// ─── Authorization helpers (Phase 1) ─────────────────────────────────
// Central guards so every API route can enforce roles + school scoping
// with a single call. Routes must still call auth() and pass the session.

export type AuthSession = Awaited<ReturnType<typeof auth>>;

export function hasRole(session: AuthSession, roles: readonly UserRole[]): boolean {
  return !!session?.user && roles.includes(session.user.role);
}

/**
 * Route guard helper. Returns an error NextResponse (401 unauthenticated,
 * 403 wrong role / no school) when the session fails the requirement, or
 * null when the request may proceed.
 */
export function requireRole(
  session: AuthSession,
  roles: readonly UserRole[],
  opts: { schoolScoped?: boolean } = {}
): NextResponse | null {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!roles.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (opts.schoolScoped && !session.user.schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
