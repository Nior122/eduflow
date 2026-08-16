import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/health/ready — readiness probe: verifies DB connectivity and
 * reports version info. Used by uptime monitors and load balancers.
 */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ready",
      db: "ok",
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "unavailable", db: "error", latencyMs: Date.now() - started },
      { status: 503 }
    );
  }
}
