import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const VIEW_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

/** GET /api/library/reports?kind=overdue|circulation&format=csv|json */
export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, VIEW_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "overdue";
  const format = url.searchParams.get("format") ?? "json";
  if (kind !== "overdue" && kind !== "circulation") {
    return NextResponse.json({ error: "Invalid report kind" }, { status: 400 });
  }

  let rows: Record<string, unknown>[] = [];
  if (kind === "overdue") {
    const overdue = await prisma.libraryBorrow.findMany({
      where: { schoolId, status: "BORROWED", dueDate: { lt: new Date() } },
      include: {
        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        book: { select: { title: true } },
        copy: { select: { copyNumber: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 500,
    });
    rows = overdue.map((b) => ({
      Student: `${b.student.lastName} ${b.student.firstName}`.trim(),
      Admission: b.student.admissionNumber,
      Book: b.book.title,
      Copy: b.copy.copyNumber,
      "Due Date": b.dueDate.toISOString().slice(0, 10),
      "Days Late": Math.max(1, Math.ceil((Date.now() - b.dueDate.getTime()) / DAY_MS)),
    }));
  } else {
    const grouped = await prisma.libraryBorrow.groupBy({
      by: ["bookId"],
      where: { schoolId },
      _count: { _all: true },
      orderBy: { _count: { bookId: "desc" } },
      take: 100,
    });
    const books = await prisma.libraryBook.findMany({
      where: { schoolId, id: { in: grouped.map((g) => g.bookId) } },
      select: { id: true, title: true },
    });
    const titles = new Map(books.map((b) => [b.id, b.title]));
    rows = grouped.map((g) => ({
      Book: titles.get(g.bookId) ?? "Unknown",
      "Total Borrows": g._count._all,
    }));
  }

  if (format === "csv") {
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="library-${kind}.csv"`,
      },
    });
  }
  return NextResponse.json({ rows });
}
