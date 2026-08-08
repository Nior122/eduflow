import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, promotionApplySchema } from "@/lib/validations";
import { adminGuard } from "@/lib/exams/guards";
import { applyPromotion, getPromotionCandidates } from "@/lib/exams/promotion";

/**
 * GET /api/promotions?classId&sessionId&termId
 * Promotion candidates for a class + term (based on published results).
 */
export async function GET(req: Request) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const sessionId = searchParams.get("sessionId");
  const termId = searchParams.get("termId");
  if (!classId || !sessionId || !termId) {
    return NextResponse.json({ error: "classId, sessionId and termId are required" }, { status: 400 });
  }

  const candidates = await getPromotionCandidates({ schoolId, classId, sessionId, termId });
  const history = await prisma.promotionRecord.findMany({
    where: { sessionId },
    include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ candidates, history });
}

/**
 * POST /api/promotions — apply a promotion/repeat/graduate/transfer/archive.
 */
export async function POST(req: Request) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await req.json();
    const parsed = validate(promotionApplySchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const student = await prisma.student.findFirst({
      where: { id: data.studentId, schoolId },
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const record = await applyPromotion({
      studentId: data.studentId,
      action: data.action,
      fromClassId: data.fromClassId,
      toClassId: data.toClassId ?? null,
      sessionId: data.sessionId,
      byUserId: g.session?.user?.id ?? "",
      note: data.note,
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to apply promotion";
    console.error("Promotion failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
