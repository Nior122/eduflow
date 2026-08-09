import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MESSAGE_ROLES, pairKey, parseAttachments } from "@/lib/messages";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * GET /api/messages/[id] — full conversation thread for a message.
 * Marks every incoming message in the thread as read.
 */
export async function GET(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, MESSAGE_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const userId = session!.user!.id;

  const { id } = await params;
  const first = await prisma.message.findFirst({
    where: {
      id,
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
      receiver: { select: { id: true, name: true, role: true } },
    },
  });
  if (!first) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const conversationId = first.conversationId ?? pairKey(first.senderId, first.receiverId);

  const raw = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: { id: true, name: true, role: true } },
      receiver: { select: { id: true, name: true, role: true } },
    },
  });

  // Only my side of the conversation, excluding rows I soft-deleted.
  const messages = raw.filter(
    (m) =>
      (m.senderId === userId && !m.deletedBySender) ||
      (m.receiverId === userId && !m.deletedByReceiver)
  );

  await prisma.message.updateMany({
    where: { conversationId, receiverId: userId, read: false },
    data: { read: true, readAt: new Date() },
  });

  return NextResponse.json({
    conversationId,
    messages: messages.map((m) => ({
      id: m.id,
      subject: m.subject,
      content: m.content,
      read: m.read,
      readAt: m.readAt?.toISOString() ?? null,
      isDraft: m.isDraft,
      replyToId: m.replyToId,
      attachments: parseAttachments(m.attachments),
      createdAt: m.createdAt.toISOString(),
      sender: { id: m.sender.id, name: m.sender.name ?? "Unknown", role: m.sender.role },
      receiver: { id: m.receiver.id, name: m.receiver.name ?? "Unknown", role: m.receiver.role },
    })),
  });
}

/** PATCH /api/messages/[id] — mark a message read (receiver only). */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, MESSAGE_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const userId = session!.user!.id;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || body.read !== true) {
    return NextResponse.json({ error: "Only read-marking is supported" }, { status: 400 });
  }

  const updated = await prisma.message.updateMany({
    where: { id, receiverId: userId },
    data: { read: true, readAt: new Date() },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/messages/[id] — soft-delete from my side only. */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, MESSAGE_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const userId = session!.user!.id;

  const { id } = await params;
  const message = await prisma.message.findFirst({
    where: { id, OR: [{ senderId: userId }, { receiverId: userId }] },
    select: { id: true, senderId: true },
  });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  if (message.senderId === userId) {
    await prisma.message.update({ where: { id }, data: { deletedBySender: true } });
  } else {
    await prisma.message.update({ where: { id }, data: { deletedByReceiver: true } });
  }
  return NextResponse.json({ ok: true });
}
