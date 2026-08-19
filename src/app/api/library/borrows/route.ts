import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, libraryBorrowSchema, libraryBorrowQuerySchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";
import { logActivity, notifyUser } from "@/lib/notifications";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;
const VIEW_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"] as const;

/** GET /api/library/borrows — borrow list with filters. Students/parents see only their own. */
export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, VIEW_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const parsed = validate(libraryBorrowQuerySchema, {
    status: url.searchParams.get("status") ?? undefined,
    studentId: url.searchParams.get("studentId") ?? undefined,
    overdue: url.searchParams.get("overdue") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid query", issues: parsed.issues }, { status: 400 });
  }
  const { status, studentId, overdue, page, pageSize } = parsed.data;

  const where: Prisma.LibraryBorrowWhereInput = { schoolId };
  if (session?.user?.role === "STUDENT") {
    where.studentId = session.user.studentId ?? "__none__";
  } else if (session?.user?.role === "PARENT") {
    where.student = { parentId: session.user.parentId ?? "__none__" };
  } else if (studentId) {
    where.studentId = studentId;
  }
  if (status === "OVERDUE") {
    where.status = "BORROWED";
    where.dueDate = { lt: new Date() };
  } else if (status) {
    where.status = status;
  } else if (overdue === "true") {
    where.status = "BORROWED";
    where.dueDate = { lt: new Date() };
  }

  const [borrows, total] = await Promise.all([
    prisma.libraryBorrow.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        book: { select: { id: true, title: true } },
        copy: { select: { id: true, copyNumber: true, barcode: true } },
        fine: { select: { id: true, amount: true, status: true } },
      },
      orderBy: [{ status: "asc" }, { borrowedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.libraryBorrow.count({ where }),
  ]);

  return NextResponse.json({ borrows, total, page, pageSize });
}

/** POST /api/library/borrows — borrow a copy for a student (transactional desk flow). */
export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  const userId = session?.user?.id;
  if (!schoolId || !userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(libraryBorrowSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const student = await prisma.student.findFirst({
      where: { id: data.studentId, schoolId, isActive: true },
      select: { id: true, userId: true },
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const settings = await prisma.librarySettings.upsert({
      where: { schoolId },
      create: { schoolId },
      update: {},
    });
    if (!settings.borrowEnabled) {
      return NextResponse.json({ error: "Borrowing is currently disabled" }, { status: 409 });
    }
    const activeCount = await prisma.libraryBorrow.count({
      where: { schoolId, studentId: student.id, status: "BORROWED" },
    });
    if (activeCount >= settings.maxActiveBorrows) {
      return NextResponse.json({ error: `Student already has ${activeCount} active borrows (limit ${settings.maxActiveBorrows})` }, { status: 409 });
    }

    const due = data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + settings.maxBorrowDays * 24 * 60 * 60 * 1000);
    if (Number.isNaN(due.getTime())) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }

    const copy = data.copyId
      ? await prisma.libraryCopy.findFirst({
          where: { id: data.copyId, schoolId, isActive: true },
          include: { book: { select: { id: true, title: true } } },
        })
      : await prisma.libraryCopy.findFirst({
          where: { bookId: data.bookId, schoolId, isActive: true, status: "AVAILABLE" },
          orderBy: { copyNumber: "asc" },
          include: { book: { select: { id: true, title: true } } },
        });
    if (!copy) return NextResponse.json({ error: "Copy not found" }, { status: 404 });
    if (copy.status !== "AVAILABLE") {
      return NextResponse.json({ error: "This copy is not available" }, { status: 409 });
    }

    const borrow = await prisma.$transaction(async (tx) => {
      await tx.libraryCopy.update({ where: { id: copy.id }, data: { status: "BORROWED" } });
      await tx.libraryBook.update({
        where: { id: copy.bookId },
        data: { availableCopies: { decrement: 1 } },
      });
      const created = await tx.libraryBorrow.create({
        data: {
          schoolId,
          copyId: copy.id,
          bookId: copy.bookId,
          studentId: student.id,
          dueDate: due,
          note: data.note ?? null,
        },
      });
      await tx.libraryReservation.updateMany({
        where: { schoolId, studentId: student.id, bookId: copy.bookId, status: "PENDING" },
        data: { status: "FULFILLED" },
      });
      return created;
    });

    await logActivity({ userId, schoolId, action: "LIBRARY_BOOK_BORROWED", entityType: "LibraryBorrow", entityId: borrow.id, metadata: { bookTitle: copy.book.title, studentId: student.id } });
    await prisma.libraryAuditLog.create({
      data: { schoolId, actorId: userId, action: "BORROW", entity: "LibraryBorrow", entityId: borrow.id, newValue: { bookId: copy.bookId, copyId: copy.id, studentId: student.id, dueDate: due.toISOString() } },
    });
    if (student.userId) {
      await notifyUser({
        userId: student.userId,
        schoolId,
        title: "Library: book borrowed",
        message: `${copy.book.title} — due ${due.toISOString().slice(0, 10)}`,
        link: "/library",
      });
    }

    const full = await prisma.libraryBorrow.findUnique({
      where: { id: borrow.id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        book: { select: { id: true, title: true } },
        copy: { select: { id: true, copyNumber: true } },
      },
    });
    return NextResponse.json({ borrow: full }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Borrow already recorded" }, { status: 409 });
    }
    console.error("Failed to create borrow:", error);
    return NextResponse.json({ error: "Failed to create borrow" }, { status: 500 });
  }
}
