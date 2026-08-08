import { NextResponse } from "next/server";
import { financeGuard } from "@/lib/finance/guards";
import { getFinanceDashboard } from "@/lib/finance/dashboard";

/** GET /api/finance/dashboard — finance widgets. */
export async function GET() {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const dashboard = await getFinanceDashboard({ schoolId });
  return NextResponse.json({ dashboard });
}
