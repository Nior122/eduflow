import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";
import { sendSaaSEmail } from "@/lib/saas/email/send";

/**
 * /api/support/tickets — school support tickets.
 * GET: the school's own tickets. POST: open a new ticket.
 */
export async function GET() {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;
  const tickets = await prisma.supportTicket.findMany({
    where: { schoolId: guard.schoolId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ tickets });
}

export async function POST(req: Request) {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const body = await parseJsonBody(req).catch(() => null);
  const subject = typeof body?.subject === "string" && body.subject.trim() ? body.subject.trim() : null;
  const description =
    typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  if (!subject || !description) {
    return NextResponse.json({ error: "subject and description are required" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      schoolId: guard.schoolId,
      createdById: guard.userId,
      subject,
      description,
      priority: body?.priority === "HIGH" || body?.priority === "URGENT" ? body.priority : "MEDIUM",
    },
  });

  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "TICKET_OPENED",
    category: "ADMIN",
    metadata: { ticketId: ticket.id },
  });

  const admin = await prisma.user.findUnique({ where: { id: guard.userId }, select: { email: true } });
  if (admin?.email) {
    await sendSaaSEmail({
      to: admin.email,
      subject: "Support ticket received",
      template: "ticket",
      data: { ticketSubject: ticket.subject },
    });
  }

  return NextResponse.json({ ticket }, { status: 201 });
}
