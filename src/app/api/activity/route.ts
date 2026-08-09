import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, activityQuerySchema } from "@/lib/validations";

const ACTIVITY_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"] as const;

/** GET /api/activity?limit=&offset= — paginated activity timeline for the current user. */
export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ACTIVITY_ROLES);
  if (denied) return denied;
  const userId = session!.user!.id;

  const url = new URL(req.url);
  const parsed = validate(
    activityQuerySchema,
    Object.fromEntries(["limit", "offset"].map((k) => [k, url.searchParams.get(k)]))
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }
  const { limit, offset } = parsed.data;

  const [logs, total] = await Promise.all([
    prisma.userActivityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.userActivityLog.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      metadata: l.metadata,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
  });
}
