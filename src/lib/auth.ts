import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import type { UserRole } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
});

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
