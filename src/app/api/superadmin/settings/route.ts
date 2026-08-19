import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";

/** GET — PlatformSettings singleton. PUT — update platform settings. */
export async function GET() {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;
  const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } });
  return NextResponse.json({ settings: settings ?? null });
}

export async function PUT(req: Request) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;

  const body = await parseJsonBody(req).catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.allowRegistration === "boolean") data.allowRegistration = body.allowRegistration;
  if (typeof body?.defaultTrialDays === "number") data.defaultTrialDays = body.defaultTrialDays;
  if (typeof body?.defaultPlanCode === "string") data.defaultPlanCode = body.defaultPlanCode;
  if (typeof body?.maintenanceMode === "boolean") data.maintenanceMode = body.maintenanceMode;
  if (typeof body?.maintenanceMessage === "string") data.maintenanceMessage = body.maintenanceMessage;
  if (typeof body?.currency === "string") data.currency = body.currency;
  if (typeof body?.supportEmail === "string") data.supportEmail = body.supportEmail;
  if (body?.announcements !== undefined) data.announcements = body.announcements;

  const settings = await prisma.platformSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  await audit({
    actorId: guard.userId,
    action: "PLATFORM_SETTINGS_UPDATED",
    category: "ADMIN",
    metadata: Object.keys(data),
  });
  return NextResponse.json({ settings });
}
