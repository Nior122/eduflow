import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, promptTemplateUpdateSchema } from "@/lib/validations";
import { aiGuard } from "@/lib/ai/guard";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLES: UserRole[] = ["SCHOOL_ADMIN", "SUPER_ADMIN"];

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/ai/prompts/[id] — edit a template. Saves a NEW version row
 * (history preserved) and deactivates the previous one.
 */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const guard = await aiGuard({ module: "assistant", roles: ADMIN_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { session, schoolId } = guard;

  const { id } = await params;
  const existing = await prisma.promptTemplate.findFirst({ where: { id, schoolId }, select: { id: true, key: true, version: true } });
  if (!existing) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });

  const body = await parseJsonBody(req).catch(() => null);
  const parsed = validate(promptTemplateUpdateSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const nextVersion = existing.version + 1;
  const created = await prisma.promptTemplate.create({
    data: {
      schoolId,
      key: existing.key,
      name: parsed.data.name ?? "Untitled prompt",
      description: parsed.data.description !== undefined ? parsed.data.description : null,
      content: parsed.data.content ?? "",
      version: nextVersion,
      isActive: true,
      isSystem: false,
      updatedById: session.user.id,
    },
  });
  await prisma.promptTemplate.update({ where: { id: existing.id }, data: { isActive: false } });

  return NextResponse.json({ prompt: created });
}

/** DELETE /api/ai/prompts/[id] — deactivate a template (history is kept). */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const guard = await aiGuard({ module: "assistant", roles: ADMIN_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { schoolId } = guard;

  const { id } = await params;
  const existing = await prisma.promptTemplate.findFirst({ where: { id, schoolId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  await prisma.promptTemplate.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
