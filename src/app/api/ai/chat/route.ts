import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validate, aiChatSchema } from "@/lib/validations";
import { chatStream, injectionGuard, resolvePrompt, sseResponse } from "@/lib/ai/core";
import { AI_TOOLS } from "@/lib/ai/tools";
import type { AiMessage, AiStreamEvent } from "@/lib/ai/types";
import { aiGuard } from "@/lib/ai/guard";
import { aiErrorResponse } from "@/lib/ai/errors";

/**
 * POST /api/ai/chat — the app-wide AI School Assistant.
 * Streaming SSE with tool calling against the real database. Conversations
 * are persisted automatically (title + messages) when the stream finishes.
 */
export async function POST(req: Request) {
  try {
    const guard = await aiGuard({ module: "assistant" });
    if (guard instanceof NextResponse) return guard;
    const { session, schoolId, userId, config } = guard;
  
    const body = await parseJsonBody(req).catch(() => null);
    const parsed = validate(aiChatSchema, body ?? {});
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { message, conversationId } = parsed.data;
  
    let conversation: { id: string; messages: unknown } | null = null;
    if (conversationId) {
      conversation = await prisma.aiConversation.findFirst({
        where: { id: conversationId, userId, schoolId },
        select: { id: true, messages: true },
      });
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
    }
  
    const existing = (conversation?.messages as AiMessage[] | null) ?? [];
    const history: AiMessage[] = [...existing, { role: "user", content: message }];
  
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
    const systemPrompt = `${injectionGuard()}\n\n${await resolvePrompt(schoolId, "assistant_system", {
    schoolName: school?.name ?? "the school",
  })}`;
  
    const gen = chatStream({
      schoolId,
      userId,
      module: "assistant",
      systemPrompt,
      messages: history,
      tools: AI_TOOLS,
      ctx: {
        schoolId,
        userId,
        role: session.user.role,
        teacherId: session.user.teacherId ?? null,
        studentId: session.user.studentId ?? null,
        parentId: session.user.parentId ?? null,
      },
    });
  
    if (!config.streamingEnabled) {
      let text = "";
      for await (const ev of gen) {
        if (ev.type === "text") text += ev.delta;
        else if (ev.type === "error") {
          return NextResponse.json({ error: ev.message }, { status: 502 });
        }
      }
      const savedId = await persistConversation(conversation?.id ?? null, userId, schoolId, history, text);
      return NextResponse.json({ text, conversationId: savedId });
    }
  
    return sseResponse(wrapWithSave(gen, conversation?.id ?? null, userId, schoolId, history));
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}

async function persistConversation(
  conversationId: string | null,
  userId: string,
  schoolId: string,
  history: AiMessage[],
  text: string
): Promise<string | null> {
  try {
    const title = (history.find((m) => m.role === "user")?.content ?? "New chat").slice(0, 60);
    const messages: AiMessage[] = [...history, { role: "assistant", content: text || "(no response)" }];
    if (conversationId) {
      await prisma.aiConversation.update({
        where: { id: conversationId },
        data: { title, messages: messages as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
      });
      return conversationId;
    }
    const row = await prisma.aiConversation.create({
      data: { userId, schoolId, module: "assistant", title, messages: messages as unknown as Prisma.InputJsonValue },
    });
    return row.id;
  } catch (error) {
    console.error("persistConversation failed:", error);
    return null;
  }
}

function wrapWithSave(
  gen: AsyncGenerator<AiStreamEvent>,
  conversationId: string | null,
  userId: string,
  schoolId: string,
  history: AiMessage[]
): AsyncGenerator<AiStreamEvent> {
  let text = "";
  async function* wrapped(): AsyncGenerator<AiStreamEvent> {
    for await (const ev of gen) {
      if (ev.type === "text") text += ev.delta;
      if (ev.type === "done") {
        const savedId = await persistConversation(conversationId, userId, schoolId, history, text);
        yield { ...ev, conversationId: savedId };
      } else {
        yield ev;
      }
    }
  }
  return wrapped();
}
