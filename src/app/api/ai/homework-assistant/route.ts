import { NextResponse } from "next/server";
import { validate, homeworkAssistantSchema } from "@/lib/validations";
import { aiStreamEvents, resolvePrompt, sseResponse } from "@/lib/ai/core";
import { aiGuard } from "@/lib/ai/guard";
import { aiErrorResponse } from "@/lib/ai/errors";
import type { UserRole } from "@prisma/client";

const ROLES: UserRole[] = ["STUDENT", "TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"];

/**
 * POST /api/ai/homework-assistant — AI Homework Assistant (Module 5).
 * Streaming SSE tutor: explains concepts and guides with hints, never
 * just hands over answers. Falls back to JSON { answer } when streaming
 * is disabled in AI settings.
 */
export async function POST(req: Request) {
  try {
    const guard = await aiGuard({ module: "homework_assistant", roles: ROLES });
    if (guard instanceof NextResponse) return guard;
    const { schoolId, userId, config } = guard;
  
    const body = await req.json().catch(() => null);
    const parsed = validate(homeworkAssistantSchema, body ?? {});
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { question, subjectTopic } = parsed.data;
  
    const prompt = await resolvePrompt(schoolId, "homework_assistant", {
      question,
      subjectTopic: subjectTopic ?? "general studies",
      className: "your class",
    });
  
    const gen = aiStreamEvents({
      schoolId,
      userId,
      module: "homework_assistant",
      messages: [{ role: "user", content: prompt }],
    });
  
    if (!config.streamingEnabled) {
      let answer = "";
      for await (const ev of gen) {
        if (ev.type === "text") answer += ev.delta;
        else if (ev.type === "error") return NextResponse.json({ error: ev.message }, { status: 502 });
      }
      return NextResponse.json({ answer });
    }
  
    return sseResponse(gen);
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}
