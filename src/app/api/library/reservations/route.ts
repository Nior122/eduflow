import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, libraryReservationSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";
import { logActivity, notifyUser } from "@/lib/notifications";

const ALL_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"] as const;
const RESERVATION_DAYS = 7;

/** GET /api/library/reservations — reservation list; students/parents see their own. */
export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ALL_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const studentId = url.searchParams.get("studentId") ?? undefined;

  const where: Prisma.LibraryReservationWhereInput = { schoolId };
  if (session?.user?.role === "STUDENT") where.studentId = session.user.studentId ?? "__none__";
  else if (session?.user?.role === "PARENT") where.student = { parentId: session.user.parentId ?? "__none__" };
  else if (studentId) where.studentId = studentId;
  if (status) where.status = status as Prisma.LibraryReservationWhereInput["status"];

  const reservations = await prisma.libraryReservation.findMany({
    where,
    include: {
      book: { select: { id: true, title: true, availableCopies: true } },
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
    },
    orderBy: { reservedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ reservations });
}

/** POST /api/library/reservations — reserve a book with no available copies. */
export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ALL_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  const userId = session?.user?.id;
  if (!schoolId || !userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody(req).catch(() => null);
  const parsed = validate(libraryReservationSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  let studentId = parsed.data.studentId;
  if (session?.user?.role === "STUDENT") {
    studentId = session.user.studentId ?? "__none__";
  }
  if (session?.user?.role === "PARENT") {
    const mine = await prisma.student.findFirst({
      where: { id: studentId, schoolId, parentId: session.user.parentId ?? "__none__" },
      select: { id: true },
    });
    if (!mine) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId, isActive: true },
    select: { id: true, userId: true },
  });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const book = await prisma.libraryBook.findFirst({
    where: { id: parsed.data.bookId, schoolId, isActive: true },
    select: { id: true, title: true, availableCopies: true },
  });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  if (book.availableCopies > 0) {
    return NextResponse.json({ error: "This book has available copies — borrow it instead" }, { status: 409 });
  }

  const existing = await prisma.libraryReservation.findFirst({
    where: { schoolId, studentId: student.id, bookId: book.id, status: "PENDING" },
  });
  if (existing) return NextResponse.json({ error: "Already reserved" }, { status: 409 });

  const expiresAt = new Date(Date.now() + RESERVATION_DAYS * 24 * 60 * 60 * 1000);
  const reservation = await prisma.libraryReservation.create({
    data: { schoolId, studentId: student.id, bookId: book.id, expiresAt },
  });

  await logActivity({ userId, schoolId, action: "LIBRARY_BOOK_RESERVED", entityType: "LibraryReservation", entityId: reservation.id, metadata: { bookTitle: book.title } });
  await prisma.libraryAuditLog.create({
    data: { schoolId, actorId: userId, action: "RESERVE", entity: "LibraryReservation", entityId: reservation.id, newValue: { bookId: book.id, studentId: student.id, expiresAt: expiresAt.toISOString() } },
  });
  if (student.userId) {
    await notifyUser({
      userId: student.userId,
      schoolId,
      title: "Library: reservation created",
      message: `${book.title} — you'll be notified when a copy is available.`,
      link: "/library",
    });
  }
  return NextResponse.json({ reservation }, { status: 201 });
}
