import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, profileUpdateSchema } from "@/lib/validations";
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

/**
 * GET /api/profile — current user: account, linked person profile and
 * preferences (preferences are upserted on first read).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      student: true,
      teacher: true,
      parent: { include: { children: { select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } } } } },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const prefs = await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, ...DEFAULT_PREFS },
    update: {},
  });

  let linked: Record<string, unknown> | null = null;
  if (user.student) {
    linked = {
      type: "STUDENT",
      firstName: user.student.firstName,
      lastName: user.student.lastName,
      admissionNumber: user.student.admissionNumber,
    };
  } else if (user.teacher) {
    linked = {
      type: "TEACHER",
      firstName: user.teacher.firstName,
      lastName: user.teacher.lastName,
      staffId: user.teacher.staffId,
      departmentId: user.teacher.departmentId,
    };
  } else if (user.parent) {
    linked = {
      type: "PARENT",
      firstName: user.parent.firstName,
      lastName: user.parent.lastName,
      children: user.parent.children.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        className: c.class?.name ?? null,
      })),
    };
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      role: user.role,
    },
    linked,
    preferences: prefs,
  });
}

/** PATCH /api/profile — update name / phone / avatar. */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const parsed = validate(profileUpdateSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
      ...(parsed.data.image !== undefined && { image: parsed.data.image || null }),
    },
  });

  await logActivity({
    userId,
    schoolId: session.user.schoolId,
    action: "PROFILE_UPDATED",
    entityType: "User",
    entityId: userId,
  });

  return NextResponse.json({
    user: { id: updated.id, name: updated.name, email: updated.email, phone: updated.phone, image: updated.image },
  });
}
