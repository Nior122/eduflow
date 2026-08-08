import { NextResponse } from "next/server";
import { validate, discountReviewSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { reviewDiscount, DiscountError } from "@/lib/finance/discounts";

type RouteCtx = { params: Promise<{ id: string }> };

/** PATCH /api/finance/discounts/[id] — approval workflow: APPROVE | REJECT. */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = validate(discountReviewSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }

    const discount = await reviewDiscount({
      discountId: id,
      schoolId,
      action: parsed.data.action,
      actorId: g.session?.user?.id ?? null,
      note: parsed.data.note,
    });
    return NextResponse.json({ discount });
  } catch (error) {
    if (error instanceof DiscountError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Failed to review discount:", error);
    return NextResponse.json({ error: "Failed to review discount" }, { status: 500 });
  }
}
