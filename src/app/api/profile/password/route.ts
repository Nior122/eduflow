import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, passwordChangeSchema } from "@/lib/validations";
import { logActivity } from "@/lib/notifications";
import { compare, hash } from "bcryptjs";

/** POST /api/profile/password — verify the current password and set a new one. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await parseJsonBody(req).catch(() => null);
  const parsed = validate(passwordChangeSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "This account has no password set" }, { status: 400 });
  }

  const valid = await compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const passwordHash = await hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await logActivity({
    userId,
    schoolId: session.user.schoolId,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: userId,
  });

  return NextResponse.json({ success: true });
}
