import { NextResponse } from "next/server";
import { validate, gatewayInitSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { initializeGatewayPayment, GatewayError } from "@/lib/finance/gateway";
import { generateReference } from "@/lib/provision";

/**
 * POST /api/finance/payments/initialize — start an online payment via the
 * school's ACTIVE gateway. Returns 400 with a clear message when no
 * gateway is configured. Nothing is mocked: adapters refuse without keys.
 */
export async function POST(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await req.json();
    const parsed = validate(gatewayInitSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const result = await initializeGatewayPayment({
      schoolId,
      input: {
        amount: data.amount,
        email: data.email,
        invoiceId: data.invoiceId,
        studentId: data.studentId,
        reference: generateReference("gateway"),
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GatewayError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Gateway initialize failed:", error);
    return NextResponse.json({ error: "Failed to initialize payment" }, { status: 500 });
  }
}
