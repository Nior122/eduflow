// ─── Phase 9 middleware ──────────────────────────────────────────────
// Edge-safe: no Prisma, no Node APIs. Adds:
//  • auth gates (unchanged from Phase 8) + SUPER_ADMIN-only /superadmin
//  • security headers + CSP (script-src 'unsafe-inline' is required for
//    Next.js hydration; move to nonce-based CSP in front of a CDN)
//  • x-tenant-id + x-request-id request headers for API routes
//  • maintenance mode (env flag or /api/internal/maintenance)
//  • brute-force limiter for the NextAuth credentials callback
import { authMiddleware as auth } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import { rateLimit, ipKey } from "@/lib/rate-limit";

const ADMIN_ROLES: readonly string[] = ["SUPER_ADMIN", "SCHOOL_ADMIN"];
const FINANCE_ROLES: readonly string[] = ["FINANCE_OFFICER", "SUPER_ADMIN", "SCHOOL_ADMIN"];

const PUBLIC_PAGES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/",
  "/pricing",
  "/unauthorized",
  "/maintenance",
];
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/health",
  "/api/cron",
  "/api/internal",
  "/api/v1",
  "/api/billing/plans",
];
const STATIC_PREFIXES = ["/_next", "/static", "/favicon", "/uploads"];

function securityHeaders(isProduction: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };
  if (isProduction) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }
  return headers;
}

async function maintenanceEnabled(baseUrl: string): Promise<boolean> {
  if (process.env.MAINTENANCE_MODE === "1") return true;
  try {
    const res = await fetch(baseUrl + "/api/internal/maintenance", {
      headers: { authorization: "Bearer " + (process.env.CRON_SECRET ?? "") },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { maintenance?: boolean };
    return data.maintenance === true;
  } catch {
    return false; // fail open on probe errors
  }
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isApi = pathname.startsWith("/api");
  const isProduction = process.env.NODE_ENV === "production";

  // Static files pass through untouched.
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p)) || pathname.includes(".")) {
    return NextResponse.next();
  }

  const isPublic =
    PUBLIC_PAGES.some((route) => pathname === route) ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));

  // Maintenance mode (after static, before everything else).
  if (await maintenanceEnabled(req.nextUrl.origin)) {
    if (pathname === "/maintenance" || isApi) {
      const res = isApi
        ? NextResponse.json({ error: "Service unavailable — maintenance in progress" }, { status: 503 })
        : NextResponse.next();
      return res;
    }
    return NextResponse.redirect(new URL("/maintenance", req.url));
  }

  // Brute-force limiter for the credentials callback.
  if (pathname === "/api/auth/callback/credentials" && req.method === "POST") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!rateLimit(ipKey(ip, "login"), { limit: 10, windowMs: 60 * 1000 })) {
      return NextResponse.json({ error: "Too many login attempts" }, { status: 429 });
    }
  }

  // Attach request context headers (routes may trust x-tenant-id).
  const res = session
    ? NextResponse.next()
    : isPublic
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login?callbackUrl=" + encodeURIComponent(pathname), req.url));

  if (res instanceof NextResponse) {
    for (const [k, v] of Object.entries(securityHeaders(isProduction))) {
      res.headers.set(k, v);
    }
    res.headers.set("x-request-id", crypto.randomUUID());
    res.headers.set("x-tenant-id", session?.user?.schoolId ?? "");
  }

  if (!session) {
    if (isPublic) return res;
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return res; // login redirect already prepared
  }

  const role = session.user.role;
  const isAuthPage = ["/login", "/register", "/forgot-password", "/reset-password"].includes(pathname);

  // Redirect authenticated users away from auth pages.
  if (isAuthPage) {
    return NextResponse.redirect(new URL(getDashboardUrl(role), req.url));
  }

  // Super admin area — SUPER_ADMIN only.
  if (pathname.startsWith("/superadmin") && role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  // Role gates for API routes (defense-in-depth; each route also self-checks).
  if (isApi) {
    const apiRoleGates: Array<[string, readonly string[]]> = [
      ["/api/superadmin", ["SUPER_ADMIN"]],
      ["/api/billing", ADMIN_ROLES],
      ["/api/feature-flags", ADMIN_ROLES],
      ["/api/onboarding", ADMIN_ROLES],
      ["/api/finance", FINANCE_ROLES],
      ["/api/admin/fees", FINANCE_ROLES],
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

  // Role-based page protection.
  if (pathname.startsWith("/admin/finance") || pathname.startsWith("/admin/fees")) {
    if (!FINANCE_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  } else if (pathname.startsWith("/admin") && !ADMIN_ROLES.includes(role)) {
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
  if (pathname.startsWith("/onboarding") && role !== "SCHOOL_ADMIN") {
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
      return "/superadmin";
    case "SCHOOL_ADMIN":
      return "/admin/dashboard";
    case "FINANCE_OFFICER":
      return "/admin/finance/dashboard";
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
