import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const VIEW_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"] as const;

/** GET /api/library/dashboard — operational stats for the library dashboard. */
export async function GET() {
  const session = await auth();
  const denied = requireRole(session, VIEW_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const [totalBooks, copiesAgg, borrowed, overdue, pendingReservations, activeBorrowers, finesAgg, recentBorrows, byCategory] =
    await Promise.all([
      prisma.libraryBook.count({ where: { schoolId, isActive: true } }),
      prisma.libraryBook.aggregate({
        where: { schoolId, isActive: true },
        _sum: { availableCopies: true },
      }),
      prisma.libraryBorrow.count({ where: { schoolId, status: "BORROWED" } }),
      prisma.libraryBorrow.count({ where: { schoolId, status: "BORROWED", dueDate: { lt: now } } }),
      prisma.libraryReservation.count({ where: { schoolId, status: "PENDING" } }),
      prisma.libraryBorrow.groupBy({ by: ["studentId"], where: { schoolId, status: "BORROWED" } }),
      prisma.libraryFine.aggregate({ where: { schoolId, status: "PENDING" }, _sum: { amount: true } }),
      prisma.libraryBorrow.findMany({
        where: { schoolId },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          book: { select: { id: true, title: true } },
        },
        orderBy: { borrowedAt: "desc" },
        take: 5,
      }),
      prisma.libraryBook.groupBy({
        by: ["categoryId"],
        where: { schoolId, isActive: true },
        _count: { _all: true },
      }),
    ]);

  const categories = await prisma.libraryCategory.findMany({
    where: { schoolId, id: { in: byCategory.map((c) => c.categoryId).filter((x): x is string => !!x) } },
    select: { id: true, name: true },
  });
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const byCategoryRows = byCategory.map((c) => ({
    categoryId: c.categoryId,
    name: c.categoryId ? categoryName.get(c.categoryId) ?? "Uncategorised" : "Uncategorised",
    count: c._count._all,
  }));

  return NextResponse.json({
    stats: {
      totalBooks,
      totalAvailable: copiesAgg._sum.availableCopies ?? 0,
      borrowed,
      overdue,
      pendingReservations,
      activeBorrowers: activeBorrowers.length,
      pendingFines: finesAgg._sum.amount ?? 0,
    },
    byCategory: byCategoryRows,
    recentBorrows,
  });
}
