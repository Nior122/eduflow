import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, libraryBookSchema, libraryBookQuerySchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/notifications";

const CATALOG_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"] as const;
const ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/library/books — catalog list with search, filters and pagination. */
export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, CATALOG_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const parsed = validate(libraryBookQuerySchema, {
    q: url.searchParams.get("q") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    available: url.searchParams.get("available") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid query", issues: parsed.issues }, { status: 400 });
  }
  const { q, categoryId, type, available, page, pageSize } = parsed.data;

  const where: Prisma.LibraryBookWhereInput = { schoolId, isActive: true };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { isbn: { contains: q, mode: "insensitive" } },
      { author: { name: { contains: q, mode: "insensitive" } } },
      { category: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (type) where.type = type;
  if (available === "true") where.availableCopies = { gt: 0 };
  if (available === "false") where.availableCopies = 0;

  const [books, total] = await Promise.all([
    prisma.libraryBook.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        publisher: { select: { id: true, name: true } },
      },
      orderBy: { title: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.libraryBook.count({ where }),
  ]);

  return NextResponse.json({ books, total, page, pageSize });
}

/** POST /api/library/books — create a book and its copies transactionally. */
export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  const userId = session?.user?.id;
  if (!schoolId || !userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(libraryBookSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;
    const totalCopies = data.totalCopies;

    const book = await prisma.$transaction(async (tx) => {
      const created = await tx.libraryBook.create({
        data: {
          title: data.title,
          subtitle: data.subtitle ?? null,
          isbn: data.isbn ?? null,
          type: data.type,
          language: data.language ?? null,
          description: data.description ?? null,
          coverUrl: data.coverUrl ?? null,
          fileUrl: data.fileUrl ?? null,
          pages: data.pages ?? null,
          shelfLocation: data.shelfLocation ?? null,
          barcode: data.barcode ?? null,
          qrData: data.qrData ?? null,
          publicationYear: data.publicationYear ?? null,
          totalCopies,
          availableCopies: totalCopies,
          categoryId: data.categoryId ?? null,
          authorId: data.authorId ?? null,
          publisherId: data.publisherId ?? null,
          schoolId,
        },
      });
      await tx.libraryCopy.createMany({
        data: Array.from({ length: totalCopies }, (_, i) => ({
          schoolId,
          bookId: created.id,
          copyNumber: i + 1,
          barcode: data.copyBarcodes?.[i] ?? null,
        })),
      });
      return created;
    });

    await logActivity({ userId, schoolId, action: "LIBRARY_BOOK_CREATED", entityType: "LibraryBook", entityId: book.id });
    await prisma.libraryAuditLog.create({
      data: { schoolId, actorId: userId, action: "CREATE", entity: "LibraryBook", entityId: book.id, newValue: { title: book.title } },
    });
    return NextResponse.json({ book }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A record with this unique value already exists" }, { status: 409 });
    }
    console.error("Failed to create book:", error);
    return NextResponse.json({ error: "Failed to create book" }, { status: 500 });
  }
}
