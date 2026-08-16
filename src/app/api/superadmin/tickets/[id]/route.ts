import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";

/** PATCH /api/superadmin/tickets/[id] — { status, priority, assignedToId }. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.status === "string") {
    const statuses = ["OPEN", "PENDING", "RESOLVED", "CLOSED"];
    if (!statuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
  }
  if (typeof body?.priority === "string") {
    const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    if (!priorities.includes(body.priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    data.priority = body.priority;
  }
  if (typeof body?.assignedToId === "string" || body?.assignedToId === null) {
    data.assignedToId = body.assignedToId;
  }

  const ticket = await prisma.supportTicket.update({ where: { id }, data });
  await audit({
    actorId: guard.userId,
    action: "TICKET_UPDATED",
    category: "ADMIN",
    metadata: { ticketId: id, status: data.status ?? ticket.status },
  });
  return NextResponse.json({ ticket });
}
