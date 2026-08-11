import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, libraryBookUpdateSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/notifications";

const CATALOG_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"] as const;
const ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/library/books/[id] — single book with its copies. */
export async function GET(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, CATALOG_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const book = await prisma.libraryBook.findFirst({
    where: { id, schoolId, isActive: true },
    include: {
      category: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
      publisher: { select: { id: true, name: true } },
      copies: {
        where: { isActive: true },
        orderBy: { copyNumber: "asc" },
        select: { id: true, copyNumber: true, barcode: true, condition: true, status: true },
      },
    },
  });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  return NextResponse.json({ book });
}

/** PATCH /api/library/books/[id] — update book details and synchronize copy count. */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  const userId = session?.user?.id;
  if (!schoolId || !userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const book = await prisma.libraryBook.findFirst({ where: { id, schoolId } });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  try {
    const body = await req.json();
    const parsed = validate(libraryBookUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { totalCopies, copyBarcodes, ...rest } = parsed.data;

    const patch: Prisma.LibraryBookUpdateInput = {};
    if (rest.title !== undefined) patch.title = rest.title;
    if (rest.subtitle !== undefined) patch.subtitle = rest.subtitle ?? null;
    if (rest.isbn !== undefined) patch.isbn = rest.isbn ?? null;
    if (rest.type !== undefined) patch.type = rest.type;
    if (rest.language !== undefined) patch.language = rest.language ?? null;
    if (rest.description !== undefined) patch.description = rest.description ?? null;
    if (rest.coverUrl !== undefined) patch.coverUrl = rest.coverUrl ?? null;
    if (rest.fileUrl !== undefined) patch.fileUrl = rest.fileUrl ?? null;
    if (rest.pages !== undefined) patch.pages = rest.pages ?? null;
    if (rest.shelfLocation !== undefined) patch.shelfLocation = rest.shelfLocation ?? null;
    if (rest.barcode !== undefined) patch.barcode = rest.barcode ?? null;
    if (rest.qrData !== undefined) patch.qrData = rest.qrData ?? null;
    if (rest.publicationYear !== undefined) patch.publicationYear = rest.publicationYear ?? null;
    if (rest.categoryId !== undefined) patch.category = rest.categoryId ? { connect: { id: rest.categoryId } } : { disconnect: true };
    if (rest.authorId !== undefined) patch.author = rest.authorId ? { connect: { id: rest.authorId } } : { disconnect: true };
    if (rest.publisherId !== undefined) patch.publisher = rest.publisherId ? { connect: { id: rest.publisherId } } : { disconnect: true };

    const updated = await prisma.$transaction(async (tx) => {
      if (totalCopies !== undefined) {
        const activeCopies = await tx.libraryCopy.findMany({
          where: { bookId: id, isActive: true },
          select: { id: true, status: true },
          orderBy: { copyNumber: "asc" },
        });
        if (totalCopies > activeCopies.length) {
          await tx.libraryCopy.createMany({
            data: Array.from({ length: totalCopies - activeCopies.length }, (_, i) => ({
              schoolId,
              bookId: id,
              copyNumber: activeCopies.length + i + 1,
            })),
          });
        } else if (totalCopies < activeCopies.length) {
          const removed = activeCopies.slice(totalCopies);
          if (removed.some((c) => c.status === "BORROWED")) {
            throw new Error("COPY_BORROWED");
          }
          await tx.libraryCopy.updateMany({
            where: { id: { in: removed.map((c) => c.id) } },
            data: { isActive: false },
          });
        }
      }
      const availableCopies = await tx.libraryCopy.count({
        where: { bookId: id, isActive: true, status: "AVAILABLE" },
      });
      const activeTotal = await tx.libraryCopy.count({ where: { bookId: id, isActive: true } });
      return tx.libraryBook.update({
        where: { id },
        data: { ...patch, totalCopies: totalCopies ?? activeTotal, availableCopies },
      });
    });

    await logActivity({ userId, schoolId, action: "LIBRARY_BOOK_UPDATED", entityType: "LibraryBook", entityId: id });
    await prisma.libraryAuditLog.create({
      data: { schoolId, actorId: userId, action: "UPDATE", entity: "LibraryBook", entityId: id, newValue: { title: updated.title } },
    });
    return NextResponse.json({ book: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "COPY_BORROWED") {
      return NextResponse.json({ error: "Cannot reduce copies: one of the removed copies is currently borrowed" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A record with this unique value already exists" }, { status: 409 });
    }
    console.error("Failed to update book:", error);
    return NextResponse.json({ error: "Failed to update book" }, { status: 500 });
  }
}

/** DELETE /api/library/books/[id] — soft delete (keeps history). */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  const userId = session?.user?.id;
  if (!schoolId || !userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const book = await prisma.libraryBook.findFirst({ where: { id, schoolId } });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const activeBorrows = await prisma.libraryBorrow.count({ where: { bookId: id, schoolId, status: "BORROWED" } });
  if (activeBorrows > 0) {
    return NextResponse.json({ error: "Cannot delete: copies of this book are currently borrowed" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.libraryBook.update({ where: { id }, data: { isActive: false } }),
    prisma.libraryCopy.updateMany({ where: { bookId: id }, data: { isActive: false } }),
  ]);
  await logActivity({ userId, schoolId, action: "LIBRARY_BOOK_DELETED", entityType: "LibraryBook", entityId: id });
  await prisma.libraryAuditLog.create({
    data: { schoolId, actorId: userId, action: "DELETE", entity: "LibraryBook", entityId: id, newValue: { title: book.title } },
  });
  return NextResponse.json({ ok: true });
}
