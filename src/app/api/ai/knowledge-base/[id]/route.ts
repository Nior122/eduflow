import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiGuard } from "@/lib/ai/guard";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLES: UserRole[] = ["SCHOOL_ADMIN", "SUPER_ADMIN"];

type RouteCtx = { params: Promise<{ id: string }> };

/** PATCH /api/ai/knowledge-base/[id] — update metadata / active state (admin). */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const guard = await aiGuard({ module: "knowledge_base", roles: ADMIN_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { schoolId } = guard;

  const { id } = await params;
  const doc = await prisma.knowledgeBaseDocument.findFirst({ where: { id, schoolId }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const data: { title?: string; description?: string | null; isActive?: boolean } = {};
  if (typeof body?.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body?.description === "string") data.description = body.description;
  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;

  const updated = await prisma.knowledgeBaseDocument.update({ where: { id }, data });
  return NextResponse.json({ document: updated });
}

/** DELETE /api/ai/knowledge-base/[id] — remove a knowledge source (admin). */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const guard = await aiGuard({ module: "knowledge_base", roles: ADMIN_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { schoolId } = guard;

  const { id } = await params;
  const doc = await prisma.knowledgeBaseDocument.findFirst({ where: { id, schoolId }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  await prisma.knowledgeBaseDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
