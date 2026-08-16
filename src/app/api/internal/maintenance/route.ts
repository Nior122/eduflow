import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/internal/maintenance — edge-middleware probe.
 * Protected by the CRON_SECRET bearer token (same secret used by cron
 * jobs). Returns { maintenance: boolean } from PlatformSettings.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } });
    return NextResponse.json({ maintenance: settings?.maintenanceMode === true });
  } catch {
    return NextResponse.json({ maintenance: false });
  }
}
