import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { verifyReceiptByCode } from "@/lib/finance/receipts";
import { FINANCE_ROLES } from "@/lib/finance/guards";

/**
 * GET /api/finance/receipts/verify?code=xxx — QR-code verification.
 * Any authenticated finance/admin user may verify a receipt.
 */
export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, FINANCE_ROLES, { schoolScoped: true });
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const result = await verifyReceiptByCode({ code });
  if (!result) return NextResponse.json({ error: "Invalid receipt code" }, { status: 404 });
  return NextResponse.json(result);
}
