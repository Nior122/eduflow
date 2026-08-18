import { NextResponse } from "next/server";
import { validate, lessonPlanSchema } from "@/lib/validations";
import { aiComplete, parseJsonLoose, resolvePrompt } from "@/lib/ai/core";
import { aiGuard } from "@/lib/ai/guard";
import { aiErrorResponse } from "@/lib/ai/errors";
import type { UserRole } from "@prisma/client";

const STAFF_ROLES: UserRole[] = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"];

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

/**
 * POST /api/ai/lesson-plan — AI Lesson Planner (Module 2).
 * Returns the same { plan } contract as Phase 5 (existing teacher page
 * keeps working) plus extensionActivities.
 */
export async function POST(req: Request) {
  const guard = await aiGuard({ module: "lesson_planner", roles: STAFF_ROLES });
  if (guard instanceof NextResponse) return guard;
  try {
    const { schoolId, userId } = guard;
  
    const body = await req.json().catch(() => null);
    const parsed = validate(lessonPlanSchema, body ?? {});
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { subject, class: cls, topic, duration, objectives, curriculum } = parsed.data;
  
    const prompt = await resolvePrompt(schoolId, "lesson_planner", {
      subject,
      class: cls,
      topic,
      duration,
      objectives: objectives ?? "",
      curriculum: curriculum ? `Curriculum notes: ${curriculum}` : "",
    });
  
    const result = await aiComplete({
      schoolId,
      userId,
      module: "lesson_planner",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
    });
  
    const raw = parseJsonLoose(result.text) as Record<string, unknown> | null;
    if (!raw) {
      return NextResponse.json({ error: "The AI returned an invalid lesson plan. Please try again." }, { status: 502 });
    }
  
    return NextResponse.json({
      plan: {
        topic: str(raw.topic, topic),
        objectives: str(raw.objectives, objectives ?? ""),
        materials: str(raw.materials),
        introduction: str(raw.introduction),
        activities: str(raw.activities),
        teacherActivity: str(raw.teacherActivity),
        studentActivity: str(raw.studentActivity),
        assessment: str(raw.assessment),
        homework: str(raw.homework),
        extensionActivities: str(raw.extensionActivities),
      },
    });
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}
