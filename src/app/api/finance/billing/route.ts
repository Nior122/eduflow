import { NextResponse } from "next/server";
import { validate, billingGenerateSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { generateInvoices } from "@/lib/finance/billing";

/**
 * POST /api/finance/billing — bulk invoice generation.
 * Body: { sessionId, termId, classId? | studentIds?, departmentId?, feeIds?, discountId?, dueDate? }
 * One invoice per student bundling the applicable fees. Skips students
 * who already hold an open invoice for the term.
 */
export async function POST(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(billingGenerateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const result = await generateInvoices({
      schoolId,
      sessionId: data.sessionId,
      termId: data.termId,
      studentIds: data.studentIds,
      classId: data.classId,
      departmentId: data.departmentId,
      feeIds: data.feeIds,
      discountId: data.discountId ?? null,
      dueDate: data.dueDate ?? null,
      issuedById: g.session?.user?.id ?? null,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(
      { generated: result.generated, skipped: result.skipped, invoices: result.invoices },
      { status: 201 }
    );
  } catch (error) {
    console.error("Billing failed:", error);
    return NextResponse.json({ error: "Billing failed" }, { status: 500 });
  }
}
