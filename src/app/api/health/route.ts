import { NextResponse } from "next/server";

/** GET /api/health — liveness probe. */
export async function GET() {
  return NextResponse.json({ status: "ok", service: "eduflow", time: new Date().toISOString() });
}
