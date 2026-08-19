import { NextResponse } from "next/server";
import { validate, planUpdateSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { updatePlanStatus, PaymentError } from "@/lib/finance/payments";

type RouteCtx = { params: Promise<{ id: string }> };

/** PATCH /api/finance/plans/[id] — COMPLETED | CANCELLED (active plans only). */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(planUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }

    const plan = await updatePlanStatus({
      planId: id,
      schoolId,
      status: parsed.data.status,
      actorId: g.session?.user?.id ?? null,
    });
    return NextResponse.json({ plan });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Failed to update plan:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
