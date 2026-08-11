import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/notifications";

const ALL_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

/** DELETE /api/library/reservations/[id] — cancel a pending reservation. */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ALL_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  const userId = session?.user?.id;
  if (!schoolId || !userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const reservation = await prisma.libraryReservation.findFirst({
    where: { id, schoolId, status: "PENDING" },
  });
  if (!reservation) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });

  if (session?.user?.role === "STUDENT" && reservation.studentId !== session.user.studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session?.user?.role === "PARENT") {
    const mine = await prisma.student.findFirst({
      where: { id: reservation.studentId, parentId: session.user.parentId ?? "__none__" },
      select: { id: true },
    });
    if (!mine) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.libraryReservation.update({ where: { id }, data: { status: "CANCELLED" } });
  await logActivity({ userId, schoolId, action: "LIBRARY_RESERVATION_CANCELLED", entityType: "LibraryReservation", entityId: id });
  await prisma.libraryAuditLog.create({
    data: { schoolId, actorId: userId, action: "CANCEL_RESERVATION", entity: "LibraryReservation", entityId: id },
  });
  return NextResponse.json({ ok: true });
}
