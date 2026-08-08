import { NextResponse } from "next/server";
import { financeGuard } from "@/lib/finance/guards";
import { getReceiptData } from "@/lib/finance/receipts";

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/finance/receipts/[id] — full receipt data for the print view. */
export async function GET(_req: Request, { params }: RouteCtx) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  const data = await getReceiptData({ receiptId: id, schoolId });
  if (!data) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  return NextResponse.json({ receipt: data });
}
