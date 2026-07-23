import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Public routes
  const publicRoutes = ["/login", "/register", "/forgot-password", "/", "/api/auth"];
  const isPublic = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith("/api/auth")
  );

  // Static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (!session && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session) {
    const role = session.user.role;
    const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password";

    // Redirect authenticated users away from auth pages
    if (isAuthPage) {
      return NextResponse.redirect(new URL(getDashboardUrl(role), req.url));
    }

    // Role-based route protection
    const adminRoutes = ["/admin"];
    const teacherRoutes = ["/teacher"];
    const parentRoutes = ["/parent"];
    const studentRoutes = ["/student"];

    if (adminRoutes.some((r) => pathname.startsWith(r)) && !["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(role)) {
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
