import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, reminderSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { getOutstanding, sendReminders, PaymentError } from "@/lib/finance/payments";

/**
 * GET /api/finance/outstanding
 * ?classId&sessionId&termId&defaulters=1
 * Recomputes overdue status first, then returns per-student balances.
 */
export async function GET(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId") ?? undefined;
  const sessionId = searchParams.get("sessionId") ?? undefined;
  const termId = searchParams.get("termId") ?? undefined;
  const onlyDefaulters = searchParams.get("defaulters") === "1";

  const rows = await getOutstanding({ schoolId, classId, sessionId, termId, onlyDefaulters });
  const totalBalance = rows.reduce((sum, r) => sum + r.balance, 0);
  const totalBilled = rows.reduce((sum, r) => sum + r.totalBilled, 0);

  return NextResponse.json({
    rows,
    totals: {
      studentsOwing: rows.length,
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalBalance: Math.round(totalBalance * 100) / 100,
    },
  });
}

/** POST /api/finance/outstanding — mark reminder records as SENT. */
export async function POST(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await req.json();
    const parsed = validate(reminderSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const count = await sendReminders({
      schoolId,
      invoiceIds: parsed.data.invoiceIds,
      actorId: g.session?.user?.id ?? null,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });
    return NextResponse.json({ sent: count });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to send reminders:", error);
    return NextResponse.json({ error: "Failed to send reminders" }, { status: 500 });
  }
}
