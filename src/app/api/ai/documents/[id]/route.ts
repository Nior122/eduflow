import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiGuard } from "@/lib/ai/guard";
import type { UserRole } from "@prisma/client";

const STAFF_ROLES: UserRole[] = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"];

type RouteCtx = { params: Promise<{ id: string }> };

/** DELETE /api/ai/documents/[id] — remove a knowledge-base document (admin or uploader). */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const guard = await aiGuard({ module: "document_assistant", roles: STAFF_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { session, schoolId } = guard;

  const { id } = await params;
  const isAdmin = session.user.role === "SCHOOL_ADMIN" || session.user.role === "SUPER_ADMIN";
  const doc = await prisma.knowledgeBaseDocument.findFirst({
    where: { id, schoolId },
    select: { id: true, uploadedById: true },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!isAdmin && doc.uploadedById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.knowledgeBaseDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
