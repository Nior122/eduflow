import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, messageSendSchema } from "@/lib/validations";
import { logActivity, notifyUser } from "@/lib/notifications";
import { MESSAGE_ROLES, pairKey } from "@/lib/messages";
import { Prisma } from "@prisma/client";


type ConvItem = {
  key: string;
  lastId: string;
  other: { id: string; name: string; role: string } | null;
  subject: string;
  snippet: string;
  isDraft: boolean;
  unread: number;
  updatedAt: string;
};

/** GET /api/messages?folder=inbox|sent|drafts&q=&limit= — conversation list. */
export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, MESSAGE_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const userId = session!.user!.id;

  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") ?? "inbox";
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 30, 1), 100);

  if (!["inbox", "sent", "drafts"].includes(folder)) {
    return NextResponse.json({ error: "Unknown folder" }, { status: 400 });
  }

  const where: Prisma.MessageWhereInput = { OR: [{ senderId: userId }, { receiverId: userId }] };
  if (folder === "inbox") {
    where.receiverId = userId;
    where.isDraft = false;
    where.deletedByReceiver = false;
  } else if (folder === "sent") {
    where.senderId = userId;
    where.isDraft = false;
    where.deletedBySender = false;
  } else {
    where.senderId = userId;
    where.isDraft = true;
  }
  if (q) {
    where.AND = [
      {
        OR: [
          { subject: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      sender: { select: { id: true, name: true, role: true } },
      receiver: { select: { id: true, name: true, role: true } },
    },
    take: 500,
  });

  const items: ConvItem[] = [];
  const seen = new Set<string>();
  for (const m of messages) {
    const key = folder === "drafts" ? `draft:${m.id}` : (m.conversationId ?? pairKey(m.senderId, m.receiverId));
    if (seen.has(key)) continue;
    seen.add(key);
    const otherFor = (u: { id: string; name: string | null; role: string }) => ({
      id: u.id,
      name: u.name ?? "Unknown",
      role: u.role,
    });
    items.push({
      key,
      lastId: m.id,
      other:
        folder === "drafts"
          ? m.receiver
            ? otherFor(m.receiver)
            : null
          : folder === "inbox"
            ? otherFor(m.sender)
            : otherFor(m.receiver),
      subject: m.subject,
      snippet: m.content.slice(0, 120),
      isDraft: m.isDraft,
      unread: 0,
      updatedAt: m.createdAt.toISOString(),
    });
  }

  // Exact unread counts for conversation-keyed groups.
  const convKeys = items.filter((i) => !i.isDraft && !i.key.startsWith("draft:")).map((i) => i.key);
  if (convKeys.length > 0) {
    const grouped = await prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        receiverId: userId,
        read: false,
        deletedByReceiver: false,
        isDraft: false,
        conversationId: { in: convKeys },
      },
      _count: { _all: true },
    });
    const unreadMap = new Map<string, number>();
    for (const g of grouped) {
      if (g.conversationId) unreadMap.set(g.conversationId, g._count._all);
    }
    for (const it of items) {
      const n = unreadMap.get(it.key);
      if (n !== undefined) it.unread = n;
    }
  }

  const [unreadMessages, unreadNotifications] = await Promise.all([
    prisma.message.count({
      where: { receiverId: userId, read: false, deletedByReceiver: false, isDraft: false },
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return NextResponse.json({
    conversations: items.slice(0, limit),
    total: items.length,
    unreadMessages,
    unreadNotifications,
  });
}

/** POST /api/messages — send a message or save/update a draft. */
export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, MESSAGE_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const userId = session!.user!.id;
  const schoolId = session!.user!.schoolId!;

  const body = await req.json().catch(() => null);
  const parsed = validate(messageSendSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }
  const data = parsed.data;

  if (!data.isDraft && !data.receiverId) {
    return NextResponse.json({ error: "Recipient is required" }, { status: 400 });
  }
  const attachments = data.attachments as Prisma.InputJsonValue | undefined;

  try {
    // Update an existing draft (partial fields allowed).
    if (data.isDraft && data.draftId) {
      const draft = await prisma.message.findFirst({
        where: { id: data.draftId, senderId: userId, isDraft: true },
      });
      if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      const updated = await prisma.message.update({
        where: { id: draft.id },
        data: {
          subject: data.subject,
          content: data.content,
          receiverId: data.receiverId ?? draft.receiverId,
          attachments: attachments ?? draft.attachments ?? Prisma.DbNull,
        },
      });
      await logActivity({
        userId,
        schoolId,
        action: "MESSAGE_SAVED_DRAFT",
        entityType: "Message",
        entityId: updated.id,
      });
      return NextResponse.json({ message: updated }, { status: 200 });
    }

    const receiverId = data.receiverId!;
    if (receiverId === userId) {
      return NextResponse.json({ error: "You cannot message yourself" }, { status: 400 });
    }
    const receiver = await prisma.user.findFirst({
      where: { id: receiverId, schoolId },
      select: { id: true },
    });
    if (!receiver) {
      return NextResponse.json({ error: "Recipient not found in your school" }, { status: 400 });
    }

    let conversationId: string | null = null;
    if (data.replyToId) {
      const replied = await prisma.message.findUnique({
        where: { id: data.replyToId },
        select: { conversationId: true },
      });
      conversationId = replied?.conversationId ?? null;
    }
    const finalConversationId = conversationId ?? pairKey(userId, receiverId);

    // Sending converts an existing draft to the same recipient.
    const existingDraft = data.isDraft
      ? null
      : await prisma.message.findFirst({
          where: { senderId: userId, receiverId, isDraft: true, deletedBySender: false },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

    let message: Awaited<ReturnType<typeof prisma.message.create>>;
    if (data.isDraft) {
      message = await prisma.message.create({
        data: {
          subject: data.subject,
          content: data.content,
          senderId: userId,
          receiverId,
          isDraft: true,
          replyToId: data.replyToId ?? null,
          attachments,
        },
      });
    } else if (existingDraft) {
      message = await prisma.message.update({
        where: { id: existingDraft.id },
        data: {
          subject: data.subject,
          content: data.content,
          isDraft: false,
          conversationId: finalConversationId,
          replyToId: data.replyToId ?? null,
          attachments,
        },
      });
    } else {
      message = await prisma.message.create({
        data: {
          subject: data.subject,
          content: data.content,
          senderId: userId,
          receiverId,
          conversationId: finalConversationId,
          replyToId: data.replyToId ?? null,
          attachments,
        },
      });
    }

    await logActivity({
      userId,
      schoolId,
      action: data.isDraft ? "MESSAGE_SAVED_DRAFT" : "MESSAGE_SENT",
      entityType: "Message",
      entityId: message.id,
    });

    if (!data.isDraft) {
      await notifyUser({
        userId: receiverId,
        schoolId,
        title: data.subject,
        message: data.content.length > 160 ? `${data.content.slice(0, 160)}…` : data.content,
        type: "MESSAGE",
        link: "/messages",
      });
    }

    return NextResponse.json({ message }, { status: data.isDraft ? 201 : 200 });
  } catch (error) {
    console.error("Failed to send message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
