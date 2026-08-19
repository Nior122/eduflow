import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, riskSchema } from "@/lib/validations";
import { aiComplete, parseJsonLoose, resolvePrompt } from "@/lib/ai/core";
import { aiGuard } from "@/lib/ai/guard";
import { aiErrorResponse } from "@/lib/ai/errors";
import { computeStudentMetrics, getScopedStudent, riskScoreFromMetrics } from "@/lib/ai/metrics";

/**
 * POST /api/ai/risk — AI Student Risk Prediction (Module 8).
 * The risk score is computed deterministically from real data (attendance
 * 30%, academics 40%, homework 20%, behaviour 10%); the AI only writes the
 * narrative over those facts. Optionally saves a PerformanceAnalysis row.
 */
export async function POST(req: Request) {
  try {
    const guard = await aiGuard({ module: "risk_prediction" });
    if (guard instanceof NextResponse) return guard;
    const { session, schoolId, userId } = guard;
  
    const body = await parseJsonBody(req).catch(() => null);
    const parsed = validate(riskSchema, body ?? {});
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
    const { riskScore, dropoutRisk, failureRisk } = riskScoreFromMetrics(metrics);
  
    const prompt = await resolvePrompt(schoolId, "risk_prediction", {
      metricsJson: JSON.stringify({ riskScore, dropoutRisk, failureRisk, ...metrics }),
    });
  
    const result = await aiComplete({
      schoolId,
      userId,
      module: "risk_prediction",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
    });
  
    const raw = (parseJsonLoose(result.text) ?? {}) as Record<string, unknown>;
    const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
    const asStr = (v: unknown, d = ""): string => (typeof v === "string" && v.trim() ? v.trim() : d);
  
    const narrative = {
      summary: asStr(raw.summary),
      factors: asList(raw.factors),
      interventions: asList(raw.interventions),
      teacherAction: asStr(raw.teacherAction),
      parentFollowUp: asStr(raw.parentFollowUp),
    };
  
    if (parsed.data.save) {
      await prisma.performanceAnalysis.create({
        data: {
          studentId: student.id,
          teacherId: session.user.teacherId ?? null,
          strengths: narrative.factors.join(", ") || "—",
          weaknesses: narrative.factors.join(", ") || "—",
          riskLevel: dropoutRisk,
          recommendations: narrative.interventions.join("\n") || "—",
          overallScore: riskScore,
        },
      });
    }
  
    return NextResponse.json({
      student: { id: student.id, name: `${student.firstName} ${student.lastName}`, className: student.class?.name ?? null },
      riskScore,
      dropoutRisk,
      failureRisk,
      metrics,
      narrative,
      saved: parsed.data.save ?? false,
    });
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}
