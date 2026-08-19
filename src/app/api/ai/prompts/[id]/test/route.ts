import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiComplete } from "@/lib/ai/core";
import { aiGuard } from "@/lib/ai/guard";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLES: UserRole[] = ["SCHOOL_ADMIN", "SUPER_ADMIN"];

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/ai/prompts/[id]/test — dry-run a prompt template with sample
 * variables (small completion, nothing saved).
 */
export async function POST(req: Request, { params }: RouteCtx) {
  const guard = await aiGuard({ module: "assistant", roles: ADMIN_ROLES });
  if (guard instanceof NextResponse) return guard;
  const { schoolId, userId } = guard;

  const { id } = await params;
  const prompt = await prisma.promptTemplate.findFirst({
    where: { id, schoolId },
    select: { content: true },
  });
  if (!prompt) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });

  const body = await parseJsonBody(req).catch(() => null);
  const variables = (body?.variables ?? {}) as Record<string, string>;
  let content = prompt.content;
  for (const [k, v] of Object.entries(variables)) {
    content = content.split(`{{${k}}}`).join(String(v ?? ""));
  }

  try {
    const result = await aiComplete({
      schoolId,
      userId,
      module: "assistant",
      messages: [{ role: "user", content }],
    });
    return NextResponse.json({ ok: true, text: result.text.slice(0, 500) });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Test failed",
    });
  }
}
