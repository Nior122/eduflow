import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, kbQuerySchema } from "@/lib/validations";
import { aiStreamEvents, resolvePrompt, sseResponse } from "@/lib/ai/core";
import type { AiStreamEvent } from "@/lib/ai/types";
import { aiGuard } from "@/lib/ai/guard";
import { mergePassages, scoreChunks } from "@/lib/ai/rag";
import type { UserRole } from "@prisma/client";

const VIEWER_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"];

/**
 * POST /api/ai/knowledge-base/query — RAG question answering (Module 12).
 * Retrieves the most relevant passages from approved school documents
 * (keyword scoring) and streams an answer with source citations.
 */
export async function POST(req: Request) {
  const guard = await aiGuard({ module: "knowledge_base", roles: VIEWER_ROLES });
  if (guard instanceof NextResponse) return guard;
  const { schoolId, userId, config } = guard;

  const body = await parseJsonBody(req).catch(() => null);
  const parsed = validate(kbQuerySchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const docs = await prisma.knowledgeBaseDocument.findMany({
    where: { schoolId, isActive: true },
    select: { id: true, title: true, chunks: true },
    take: 200,
  });

  const passages = mergePassages(docs.map((d) => scoreChunks(parsed.data.question, d)), 5);

  let gen;
  if (passages.length === 0) {
    gen = noSources(parsed.data.question);
  } else {
    const prompt = await resolvePrompt(schoolId, "knowledge_base", {
      passages: passages.map((p) => `[Source: ${p.source}]\n${p.text}`).join("\n\n---\n\n"),
      question: parsed.data.question,
    });
    gen = aiStreamEvents({
      schoolId,
      userId,
      module: "knowledge_base",
      messages: [{ role: "user", content: prompt }],
    });
  }

  if (!config.streamingEnabled) {
    let text = "";
    for await (const ev of gen) {
      if (ev.type === "text") text += ev.delta;
      else if (ev.type === "error") return NextResponse.json({ error: ev.message }, { status: 502 });
    }
    return NextResponse.json({ text, sources: passages.map((p) => p.source) });
  }

  return sseResponse(withSources(gen, passages.map((p) => p.source)));
}

async function* noSources(question: string): AsyncGenerator<AiStreamEvent> {
  yield {
    type: "text",
    delta: `I couldn't find anything about "${question.slice(0, 80)}" in the school's approved knowledge base yet. An administrator can add relevant documents (handbooks, policies, past questions…) under **AI → Knowledge Base**.`,
  };
  yield { type: "done", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
}

async function* withSources(
  gen: AsyncGenerator<AiStreamEvent>,
  sources: string[]
): AsyncGenerator<AiStreamEvent> {
  yield { type: "sources", sources };
  yield* gen;
}
