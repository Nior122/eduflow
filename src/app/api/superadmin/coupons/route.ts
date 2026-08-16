import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";

/** GET — all coupons. POST — create coupon. */
export async function GET() {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ coupons });
}

export async function POST(req: Request) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.toUpperCase().trim() : null;
  if (!code || !/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return NextResponse.json({ error: "code must be 3-32 chars (A-Z, 0-9, _ or -)" }, { status: 400 });
  }
  const discountType = body?.discountType === "FIXED" ? "FIXED" : "PERCENT";
  const discountValue = Number(body?.discountValue ?? 0);
  if (discountValue <= 0) {
    return NextResponse.json({ error: "discountValue must be positive" }, { status: 400 });
  }
  if (discountType === "PERCENT" && discountValue > 100) {
    return NextResponse.json({ error: "PERCENT discount cannot exceed 100" }, { status: 400 });
  }

  const coupon = await prisma.coupon.create({
    data: {
      code,
      description: typeof body?.description === "string" ? body.description : null,
      discountType,
      discountValue,
      currency: typeof body?.currency === "string" ? body.currency : null,
      maxRedemptions: typeof body?.maxRedemptions === "number" ? body.maxRedemptions : null,
      validFrom: body?.validFrom ? new Date(String(body.validFrom)) : null,
      validUntil: body?.validUntil ? new Date(String(body.validUntil)) : null,
      createdById: guard.userId,
    },
  });
  await audit({
    actorId: guard.userId,
    action: "COUPON_CREATED",
    category: "ADMIN",
    metadata: { code: coupon.code, discountType, discountValue },
  });
  return NextResponse.json({ coupon }, { status: 201 });
}
