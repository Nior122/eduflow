import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractText } from "@/lib/ai/extract";
import { chunkText } from "@/lib/ai/rag";
import { aiGuard } from "@/lib/ai/guard";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLES: UserRole[] = ["SCHOOL_ADMIN", "SUPER_ADMIN"];
const VIEWER_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"];

/** GET /api/ai/knowledge-base — approved school knowledge documents (metadata only). */
export async function GET() {
  const guard = await aiGuard({ module: "knowledge_base", roles: VIEWER_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { schoolId } = guard;

  const docs = await prisma.knowledgeBaseDocument.findMany({
    where: { schoolId, isActive: true },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
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
      charCount: d.content?.length ?? 0,
    })),
  });
}

/**
 * POST /api/ai/knowledge-base — add an approved knowledge source (admin).
 * Accepts multipart (file + title/description) or JSON { title, content }.
 */
export async function POST(req: Request) {
  const guard = await aiGuard({ module: "knowledge_base", roles: ADMIN_ROLES });
  if (guard instanceof NextResponse) return guard;
  const { session, schoolId, userId } = guard;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds the 10 MB limit" }, { status: 400 });
    }
    const extracted = await extractText(file);
    if (!extracted || !extracted.text.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from this file. Supported: txt, md, csv, pdf, docx, xlsx." },
        { status: 400 }
      );
    }
    const title = form.get("title");
    const doc = await prisma.knowledgeBaseDocument.create({
      data: {
        title: typeof title === "string" && title.trim() ? title.trim() : file.name,
        description: typeof form.get("description") === "string" ? (form.get("description") as string) : null,
        sourceType: extracted.sourceType,
        fileName: file.name,
        content: extracted.text,
        chunks: chunkText(extracted.text),
        schoolId,
        uploadedById: userId,
      },
    });
    return NextResponse.json({ document: doc }, { status: 201 });
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }
  const doc = await prisma.knowledgeBaseDocument.create({
    data: {
      title,
      description: typeof body?.description === "string" ? body.description : null,
      sourceType: "TEXT",
      content,
      chunks: chunkText(content),
      schoolId,
      uploadedById: userId,
    },
  });
  return NextResponse.json({ document: doc }, { status: 201 });
}
