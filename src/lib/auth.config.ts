/**
 * EduFlow — edge-safe NextAuth configuration.
 *
 * The middleware bundle runs on the Edge Runtime, which has no Node.js
 * APIs. The full auth config in `./auth` imports bcryptjs (password
 * compare) and Prisma via the credentials provider, so the middleware
 * must use this provider-free, edge-safe config instead. Node-only
 * pieces (providers, events) stay in `./auth` and extend this config.
 */
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";

export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: UserRole }).role || "SCHOOL_ADMIN";
        token.schoolId = (user as { schoolId?: string }).schoolId || null;
        token.studentId = (user as { studentId?: string }).studentId || null;
        token.teacherId = (user as { teacherId?: string }).teacherId || null;
        token.parentId = (user as { parentId?: string }).parentId || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { role: UserRole }).role = token.role as UserRole;
        (session.user as { schoolId: string | null }).schoolId = token.schoolId as string | null;
        (session.user as { studentId: string | null }).studentId = token.studentId as string | null;
        (session.user as { teacherId: string | null }).teacherId = token.teacherId as string | null;
        (session.user as { parentId: string | null }).parentId = token.parentId as string | null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

const nextAuth = NextAuth(authConfig);

/**
 * Middleware variant of `auth` (NextAuth v5 wrapper used by
 * src/middleware.ts) — accepts a handler receiving { req, auth }.
 */
export const authMiddleware = nextAuth.auth as unknown as (
  handler: (req: Parameters<Parameters<typeof nextAuth.auth>[0]>[0] & { auth: Session | null }) => unknown
) => (req: unknown) => unknown;
