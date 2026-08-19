import { NextResponse } from "next/server";
import { validate, performanceSchema } from "@/lib/validations";
import { aiComplete, parseJsonLoose, resolvePrompt } from "@/lib/ai/core";
import { aiGuard } from "@/lib/ai/guard";
import { aiErrorResponse } from "@/lib/ai/errors";
import { computeStudentMetrics, getScopedStudent } from "@/lib/ai/metrics";

/**
 * POST /api/ai/performance — AI Performance Analyzer (Module 4).
 * Computes real metrics from the database and has the AI turn them into
 * strengths, weak subjects, recommendations, learning pattern and an
 * improvement plan. Students/parents see their own/children's data only.
 */
export async function POST(req: Request) {
  try {
    const guard = await aiGuard({ module: "performance_analyzer" });
    if (guard instanceof NextResponse) return guard;
    const { session, schoolId, userId } = guard;
  
    const body = await parseJsonBody(req).catch(() => null);
    const parsed = validate(performanceSchema, body ?? {});
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
  
    const student = await getScopedStudent({
      studentId: parsed.data.studentId,
      schoolId,
      role: session.user.role,
      teacherId: session.user.teacherId ?? null,
      parentId: session.user.parentId ?? null,
      studentOwnId: session.user.studentId ?? null,
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  
    const metrics = await computeStudentMetrics(student.id, schoolId);
  
    const prompt = await resolvePrompt(schoolId, "performance_analyzer", {
      name: `${student.firstName} ${student.lastName}`,
      className: student.class?.name ?? "—",
      metricsJson: JSON.stringify(metrics),
    });
  
    const result = await aiComplete({
      schoolId,
      userId,
      module: "performance_analyzer",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
    });
  
    const raw = (parseJsonLoose(result.text) ?? {}) as Record<string, unknown>;
  
    const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
    const asStr = (v: unknown, d = ""): string => (typeof v === "string" && v.trim() ? v.trim() : d);
  
    const analysis = {
      strengths: asList(raw.strengths),
      weakSubjects: asList(raw.weakSubjects),
      recommendations: asList(raw.recommendations),
      learningPattern: asStr(raw.learningPattern),
      improvementPlan: asList(raw.improvementPlan),
      trendSummary: asStr(raw.trendSummary),
    };
  
    return NextResponse.json({
      student: { id: student.id, name: `${student.firstName} ${student.lastName}`, className: student.class?.name ?? null },
      metrics,
      analysis,
    });
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}
