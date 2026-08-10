import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, promptTemplateSchema } from "@/lib/validations";
import { DEFAULT_PROMPTS } from "@/lib/ai/prompts";
import { aiGuard } from "@/lib/ai/guard";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLES: UserRole[] = ["SCHOOL_ADMIN", "SUPER_ADMIN"];

/** GET /api/ai/prompts — prompt templates for this school (incl. built-in defaults). */
export async function GET() {
  const guard = await aiGuard({ module: "assistant", roles: ADMIN_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { schoolId } = guard;

  const rows = await prisma.promptTemplate.findMany({
    where: { schoolId },
    orderBy: [{ key: "asc" }, { version: "desc" }],
    take: 500,
  });

  // Merge built-in defaults so admins see every prompt even before editing.
  const byKey = new Map<string, { row: (typeof rows)[number] | null; builtIn: { name: string; description: string; content: string } | null }>();
  for (const key of Object.keys(DEFAULT_PROMPTS)) {
    byKey.set(key, { row: null, builtIn: DEFAULT_PROMPTS[key] });
  }
  for (const r of rows) {
    const cur = byKey.get(r.key) ?? { row: null, builtIn: null };
    cur.row = r;
    byKey.set(r.key, cur);
  }

  const prompts = [...byKey.entries()].map(([key, v]) => ({
    key,
    name: v.row?.name ?? v.builtIn?.name ?? key,
    description: v.row?.description ?? v.builtIn?.description ?? null,
    content: v.row?.content ?? v.builtIn?.content ?? "",
    version: v.row?.version ?? 1,
    isActive: v.row?.isActive ?? true,
    isSystem: v.row?.isSystem ?? true,
    id: v.row?.id ?? null,
    updatedAt: v.row?.updatedAt.toISOString() ?? null,
  }));

  return NextResponse.json({ prompts });
}

/** POST /api/ai/prompts — create a new template (version 1). */
export async function POST(req: Request) {
  const guard = await aiGuard({ module: "assistant", roles: ADMIN_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { session, schoolId } = guard;

  const body = await req.json().catch(() => null);
  const parsed = validate(promptTemplateSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const prompt = await prisma.promptTemplate.create({
    data: {
      schoolId,
      key: parsed.data.key,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      content: parsed.data.content,
      version: 1,
      isSystem: false,
      updatedById: session.user.id,
    },
  });
  return NextResponse.json({ prompt }, { status: 201 });
}
