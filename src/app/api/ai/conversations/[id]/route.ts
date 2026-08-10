import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/ai/conversations/[id] — full conversation with messages. */
export async function GET(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const conversation = await prisma.aiConversation.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, title: true, module: true, messages: true, updatedAt: true },
  });
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      module: conversation.module,
      messages: conversation.messages,
      updatedAt: conversation.updatedAt.toISOString(),
    },
  });
}

/** DELETE /api/ai/conversations/[id] — remove one of the user's conversations. */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = await prisma.aiConversation.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (deleted.count === 0) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
