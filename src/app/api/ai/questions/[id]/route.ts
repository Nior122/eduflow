import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiGuard } from "@/lib/ai/guard";
import type { UserRole } from "@prisma/client";

const STAFF_ROLES: UserRole[] = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"];

type RouteCtx = { params: Promise<{ id: string }> };

/** DELETE /api/ai/questions/[id] — remove one banked question (author or staff). */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const guard = await aiGuard({ module: "question_generator", roles: STAFF_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { session, schoolId } = guard;

  const { id } = await params;
  const isAdmin = session.user.role === "SCHOOL_ADMIN" || session.user.role === "SUPER_ADMIN";
  const question = await prisma.questionBank.findFirst({
    where: { id, schoolId },
    select: { id: true, createdById: true },
  });
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });
  if (!isAdmin && question.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.questionBank.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
