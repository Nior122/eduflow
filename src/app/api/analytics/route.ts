import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { staffGuard } from "@/lib/exams/guards";
import {
  getClassAnalytics,
  getClassTrend,
  getSchoolAnalytics,
} from "@/lib/exams/analytics";

/**
 * GET /api/analytics
 *   ?classId&sessionId&termId        → class analytics
 *   ?classId only                     → class performance trend
 *   ?schoolId&sessionId&termId        → school-wide analytics
 */
export async function GET(req: Request) {
  const g = await staffGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const sessionId = searchParams.get("sessionId");
  const termId = searchParams.get("termId");

  if (classId && sessionId && termId) {
    const analytics = await getClassAnalytics({ classId, sessionId, termId });
    if (!analytics) return NextResponse.json({ error: "Class not found" }, { status: 404 });
    return NextResponse.json({ analytics });
  }

  if (classId) {
    const trend = await getClassTrend({ classId });
    return NextResponse.json({ trend });
  }

  if (sessionId && termId) {
    const analytics = await getSchoolAnalytics({ schoolId, sessionId, termId });
    return NextResponse.json({ analytics });
  }

  // Fallback: pick active session + its active term.
  const activeSession = await prisma.academicSession.findFirst({
    where: { schoolId, isActive: true },
    include: { terms: { where: { isActive: true }, take: 1 } },
  });
  if (activeSession?.terms[0]) {
    const analytics = await getSchoolAnalytics({
      schoolId,
      sessionId: activeSession.id,
      termId: activeSession.terms[0].id,
    });
    return NextResponse.json({ analytics });
  }

  return NextResponse.json({ analytics: null, message: "No active session/term configured" });
}
