import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, libraryReturnSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";
import { logActivity, notifyUser } from "@/lib/notifications";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

const DAY_MS = 24 * 60 * 60 * 1000;

/** POST /api/library/borrows/[id]/return — return a copy, compute late fee, restore availability. */
export async function POST(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  const userId = session?.user?.id;
  if (!schoolId || !userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const borrow = await prisma.libraryBorrow.findFirst({
    where: { id, schoolId, status: "BORROWED" },
    include: {
      book: { select: { id: true, title: true } },
      copy: { select: { id: true, condition: true } },
      student: { select: { id: true, userId: true } },
    },
  });
  if (!borrow) return NextResponse.json({ error: "Active borrow not found" }, { status: 404 });

  const body = await parseJsonBody(req).catch(() => ({}));
  const parsed = validate(libraryReturnSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }
  const data = parsed.data;

  const settings = await prisma.librarySettings.upsert({ where: { schoolId }, create: { schoolId }, update: {} });
  const now = new Date();
  const daysLate = borrow.dueDate < now ? Math.ceil((now.getTime() - borrow.dueDate.getTime()) / DAY_MS) : 0;
  const lateFeeAmount = daysLate > 0 ? daysLate * Number(settings.lateFeePerDay) : null;

  const returned = await prisma.$transaction(async (tx) => {
    const updated = await tx.libraryBorrow.update({
      where: { id },
      data: {
        status: "RETURNED",
        returnedAt: now,
        returnedCondition: data.returnedCondition ?? null,
        note: data.note ?? null,
        lateFeeAmount: lateFeeAmount !== null ? new Prisma.Decimal(lateFeeAmount) : null,
      },
    });
    await tx.libraryCopy.update({
      where: { id: borrow.copyId },
      data: {
        status: "AVAILABLE",
        condition: data.returnedCondition ?? borrow.copy.condition,
      },
    });
    await tx.libraryBook.update({
      where: { id: borrow.bookId },
      data: { availableCopies: { increment: 1 } },
    });
    if (lateFeeAmount !== null) {
      await tx.libraryFine.create({
        data: {
          schoolId,
          borrowId: id,
          studentId: borrow.studentId,
          amount: new Prisma.Decimal(lateFeeAmount),
          reason: `Late return (${daysLate} day${daysLate > 1 ? "s" : ""} overdue at ${settings.lateFeePerDay}/day)`,
        },
      });
    }
    return updated;
  });

  await logActivity({
    userId,
    schoolId,
    action: lateFeeAmount !== null ? "LIBRARY_BOOK_RETURNED_LATE" : "LIBRARY_BOOK_RETURNED",
    entityType: "LibraryBorrow",
    entityId: id,
    metadata: { bookTitle: borrow.book.title, daysLate, lateFeeAmount },
  });
  await prisma.libraryAuditLog.create({
    data: { schoolId, actorId: userId, action: "RETURN", entity: "LibraryBorrow", entityId: id, newValue: { returnedAt: now.toISOString(), daysLate, lateFeeAmount } },
  });
  if (borrow.student.userId) {
    await notifyUser({
      userId: borrow.student.userId,
      schoolId,
      title: lateFeeAmount !== null ? "Library: late return — fee charged" : "Library: book returned",
      message:
        lateFeeAmount !== null
          ? `${borrow.book.title} returned ${daysLate} day(s) late. Fine: ${settings.lateFeePerDay} per day.`
          : `${borrow.book.title} returned successfully.`,
      link: "/library",
    });
  }

  return NextResponse.json({ borrow: returned, daysLate, lateFeeAmount });
}
