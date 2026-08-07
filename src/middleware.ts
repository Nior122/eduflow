import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isApi = pathname.startsWith("/api");

  // Public routes
  const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/", "/unauthorized"];
  const isPublic =
    publicRoutes.some((route) => pathname === route) || pathname.startsWith("/api/auth");

  // Static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (!session) {
    // API routes must answer with JSON, not an HTML redirect
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isPublic) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const role = session.user.role;
  const isAuthPage = ["/login", "/register", "/forgot-password", "/reset-password"].includes(pathname);

  // Redirect authenticated users away from auth pages
  if (isAuthPage) {
    return NextResponse.redirect(new URL(getDashboardUrl(role), req.url));
  }

  // Role gates for API routes (defense-in-depth; each route also self-checks)
  if (isApi) {
    const apiRoleGates: Array<[string, readonly string[]]> = [
      ["/api/admin", ADMIN_ROLES],
      ["/api/attendance", ["TEACHER", ...ADMIN_ROLES]],
      ["/api/results", ["TEACHER", ...ADMIN_ROLES]],
      ["/api/teacher", ["TEACHER"]],
      ["/api/parent", ["PARENT"]],
      ["/api/student", ["STUDENT"]],
    ];
    for (const [prefix, allowed] of apiRoleGates) {
      if (pathname.startsWith(prefix)) {
        if (!allowed.includes(role)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        break;
      }
    }
    return NextResponse.next();
  }

  // Role-based page protection
  if (pathname.startsWith("/admin") && !ADMIN_ROLES.includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }
  if (pathname.startsWith("/teacher") && role !== "TEACHER") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }
  if (pathname.startsWith("/parent") && role !== "PARENT") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }
  if (pathname.startsWith("/student") && role !== "STUDENT") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};

function getDashboardUrl(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "SCHOOL_ADMIN":
      return "/admin/dashboard";
    case "TEACHER":
      return "/teacher/dashboard";
    case "PARENT":
      return "/parent/dashboard";
    case "STUDENT":
      return "/student/dashboard";
    default:
      return "/admin/dashboard";
  }
}
