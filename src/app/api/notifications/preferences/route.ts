import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, preferencesUpdateSchema } from "@/lib/validations";
import { logActivity } from "@/lib/notifications";

const DEFAULT_PREFS = {
  language: "en",
  theme: "SYSTEM",
  emailNotifications: true,
  smsNotifications: true,
  pushNotifications: true,
  inAppNotifications: true,
  twoFactorEnabled: false,
};

/** GET /api/notifications/preferences — current user's notification settings (upserted on first read). */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const prefs = await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, ...DEFAULT_PREFS },
    update: {},
  });

  return NextResponse.json({ preferences: prefs });
}

/** PATCH /api/notifications/preferences — update notification/theme/language preferences. */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await parseJsonBody(req).catch(() => null);
  const parsed = validate(preferencesUpdateSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const prefs = await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, ...DEFAULT_PREFS, ...parsed.data },
    update: parsed.data,
  });

  await logActivity({
    userId,
    schoolId: session.user.schoolId,
    action: "PREFERENCES_UPDATED",
    entityType: "UserPreference",
  });

  return NextResponse.json({ preferences: prefs });
}
