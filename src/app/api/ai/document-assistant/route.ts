import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, docAssistantSchema } from "@/lib/validations";
import { aiStreamEvents, resolvePrompt, sseResponse } from "@/lib/ai/core";
import type { AiStreamEvent } from "@/lib/ai/types";
import { truncateText } from "@/lib/ai/providers";
import { aiGuard } from "@/lib/ai/guard";
import { aiErrorResponse } from "@/lib/ai/errors";
import { chunkText } from "@/lib/ai/rag";
import { extractText } from "@/lib/ai/extract";
import type { UserRole } from "@prisma/client";

const STAFF_ROLES: UserRole[] = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/ai/document-assistant — AI Document Assistant (Module 11).
 * Multipart form: file, title?, action ("summarize" | "ask"), question?
 * Extracts text (PDF/Word/Excel/plain), stores it in the knowledge base
 * and streams the summary or a document-grounded answer over SSE.
 */
export async function POST(req: Request) {
  try {
    const guard = await aiGuard({ module: "document_assistant", roles: STAFF_ROLES });
    if (guard instanceof NextResponse) return guard;
    const { session, schoolId, userId, config } = guard;
  
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
  
    const file = form.get("file");
    const titleRaw = form.get("title");
    const parsed = validate(
      docAssistantSchema,
      Object.fromEntries(["action", "question"].map((k) => [k, form.get(k) ?? undefined]))
    );
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File exceeds the 10 MB limit" }, { status: 400 });
    }
    if (parsed.data.action === "ask" && !parsed.data.question?.trim()) {
      return NextResponse.json({ error: "A question is required" }, { status: 400 });
    }
  
    const extracted = await extractText(file);
    if (!extracted || !extracted.text.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from this file. Supported: txt, md, csv, pdf, docx, xlsx." },
        { status: 400 }
      );
    }
  
    const doc = await prisma.knowledgeBaseDocument.create({
      data: {
        title: typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : file.name,
        sourceType: extracted.sourceType,
        fileName: file.name,
        content: extracted.text,
        chunks: chunkText(extracted.text),
        schoolId,
        uploadedById: userId,
      },
    });
  
    const content = truncateText(extracted.text, 12000);
    const prompt =
      parsed.data.action === "summarize"
        ? await resolvePrompt(schoolId, "document_summary", {
            sourceType: extracted.sourceType,
            title: doc.title,
            content,
          })
        : await resolvePrompt(schoolId, "document_qa", {
            title: doc.title,
            content,
            question: parsed.data.question!.trim(),
          });
  
    const gen = aiStreamEvents({
      schoolId,
      userId,
      module: "document_assistant",
      messages: [{ role: "user", content: prompt }],
    });
  
    if (!config.streamingEnabled) {
      let text = "";
      for await (const ev of gen) {
        if (ev.type === "text") text += ev.delta;
        else if (ev.type === "error") return NextResponse.json({ error: ev.message }, { status: 502 });
      }
      return NextResponse.json({ documentId: doc.id, text });
    }
  
    // Attach the document id as the first SSE event so the client can link it.
    const withMeta = attachMeta(gen, doc.id);
    return sseResponse(withMeta);
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}

async function* attachMeta(
  gen: AsyncGenerator<AiStreamEvent>,
  documentId: string
): AsyncGenerator<AiStreamEvent> {
  yield { type: "meta", documentId };
  yield* gen;
}

/** GET /api/ai/documents — knowledge-base document list (staff). */
export async function GET() {
  try {
    const guard = await aiGuard({ module: "document_assistant", roles: STAFF_ROLES, budgetCheck: false });
    if (guard instanceof NextResponse) return guard;
    const { schoolId } = guard;
  
    const docs = await prisma.knowledgeBaseDocument.findMany({
      where: { schoolId, isActive: true },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  
    return NextResponse.json({
      documents: docs.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        sourceType: d.sourceType,
        fileName: d.fileName,
        uploader: d.uploadedBy?.name ?? null,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}
