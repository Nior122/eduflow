import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, parentCommSendSchema } from "@/lib/validations";
import { aiGuard } from "@/lib/ai/guard";
import { aiErrorResponse } from "@/lib/ai/errors";
import { getScopedStudent } from "@/lib/ai/metrics";
import { pairKey } from "@/lib/messages";
import { logActivity, notifyUser } from "@/lib/notifications";
import type { UserRole } from "@prisma/client";

const STAFF_ROLES: UserRole[] = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"];

/**
 * POST /api/ai/parent-communication/send — deliver an (edited) AI-drafted
 * message to the parent via the internal messaging system + notification.
 */
export async function POST(req: Request) {
  const guard = await aiGuard({ module: "parent_communication", roles: STAFF_ROLES });
  if (guard instanceof NextResponse) return guard;
  try {
    const { session, schoolId, userId } = guard;
  
    const body = await req.json().catch(() => null);
    const parsed = validate(parentCommSendSchema, body ?? {});
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
  
    const student = await getScopedStudent({
      studentId: parsed.data.studentId,
      schoolId,
      role: session.user.role,
      teacherId: session.user.teacherId ?? null,
      parentId: session.user.parentId ?? null,
      studentOwnId: session.user.studentId ?? null,
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if (!student.parentId) {
      return NextResponse.json({ error: "This student has no linked parent" }, { status: 400 });
    }
  
    const parentUser = await prisma.user.findFirst({
      where: { schoolId, role: "PARENT", parent: { id: student.parentId } },
      select: { id: true, name: true },
    });
    if (!parentUser) {
      return NextResponse.json(
        { error: "The parent has no portal account yet — create one before sending." },
        { status: 400 }
      );
    }
  
    const message = await prisma.message.create({
      data: {
        senderId: userId,
        receiverId: parentUser.id,
        subject: parsed.data.subject,
        content: parsed.data.content,
        conversationId: pairKey(userId, parentUser.id),
      },
    });
  
    await notifyUser({
      userId: parentUser.id,
      schoolId,
      title: parsed.data.subject,
      message: parsed.data.content.length > 160 ? `${parsed.data.content.slice(0, 160)}…` : parsed.data.content,
      type: "MESSAGE",
      link: "/messages",
    });
  
    await logActivity({
      userId,
      schoolId,
      action: "MESSAGE_SENT",
      entityType: "Message",
      entityId: message.id,
      metadata: { via: "ai_parent_communication", to: parentUser.name },
    });
  
    return NextResponse.json({ ok: true, messageId: message.id, to: parentUser.name });
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}
