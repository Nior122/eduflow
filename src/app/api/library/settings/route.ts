import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, librarySettingsSchema } from "@/lib/validations";
import { logActivity } from "@/lib/notifications";

const VIEW_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;
const ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/library/settings — library policy settings (get-or-create). */
export async function GET() {
  const session = await auth();
  const denied = requireRole(session, VIEW_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await prisma.librarySettings.upsert({
    where: { schoolId },
    create: { schoolId },
    update: {},
  });
  return NextResponse.json({ settings });
}

/** PATCH /api/library/settings — update library policy. */
export async function PATCH(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  const userId = session?.user?.id;
  if (!schoolId || !userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody(req).catch(() => null);
  const parsed = validate(librarySettingsSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }
  const data = parsed.data;

  const settings = await prisma.librarySettings.upsert({
    where: { schoolId },
    create: { schoolId, ...data },
    update: data,
  });
  await logActivity({ userId, schoolId, action: "LIBRARY_SETTINGS_UPDATED", entityType: "LibrarySettings", entityId: settings.id, metadata: data });
  await prisma.libraryAuditLog.create({
    data: { schoolId, actorId: userId, action: "UPDATE", entity: "LibrarySettings", entityId: settings.id, newValue: data },
  });
  return NextResponse.json({ settings });
}
