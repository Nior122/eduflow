import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, notificationMarkSchema } from "@/lib/validations";

const NOTIFICATION_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"] as const;

/** GET /api/notifications?limit=&offset=&unreadOnly=1 — notification center. */
export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, NOTIFICATION_ROLES);
  if (denied) return denied;
  const userId = session!.user!.id;

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
  const unreadOnly = url.searchParams.get("unreadOnly") === "1";

  const [notifications, unread, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      link: n.link,
      createdAt: n.createdAt.toISOString(),
    })),
    unread,
    total,
  });
}

/** PATCH /api/notifications — mark specific ids read, or all. */
export async function PATCH(req: Request) {
  const session = await auth();
  const denied = requireRole(session, NOTIFICATION_ROLES);
  if (denied) return denied;
  const userId = session!.user!.id;

  const body = await parseJsonBody(req).catch(() => null);
  const parsed = validate(notificationMarkSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  if (parsed.data.all) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  } else if (parsed.data.ids && parsed.data.ids.length > 0) {
    await prisma.notification.updateMany({
      where: { userId, id: { in: parsed.data.ids } },
      data: { read: true, readAt: new Date() },
    });
  } else {
    return NextResponse.json({ error: "Nothing to mark" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
