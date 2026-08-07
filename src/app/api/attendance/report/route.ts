import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "SICK"] as const;

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const studentId = searchParams.get("studentId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format");

  const where: Record<string, unknown> = { class: { schoolId } };
  if (classId) where.classId = classId;
  if (studentId) where.studentId = studentId;
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const attendances = await prisma.attendance.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      class: { select: { id: true, name: true } },
    },
    orderBy: [{ student: { lastName: "asc" } }, { date: "asc" }],
    take: 5000,
  });

  // Aggregate per student
  const byStudent = new Map<
    string,
    { id: string; name: string; admissionNumber: string; class: string | null; counts: Record<string, number> }
  >();
  for (const a of attendances) {
    const key = a.studentId;
    let entry = byStudent.get(key);
    if (!entry) {
      entry = {
        id: key,
        name: `${a.student.firstName} ${a.student.lastName}`,
        admissionNumber: a.student.admissionNumber,
        class: a.class.name,
        counts: Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<string, number>,
      };
      byStudent.set(key, entry);
    }
    entry.counts[a.status] = (entry.counts[a.status] ?? 0) + 1;
  }

  const rows = [...byStudent.values()].map((s) => {
    const total = STATUSES.reduce((sum, st) => sum + (s.counts[st] ?? 0), 0);
    const rate = total > 0 ? Math.round(((s.counts.PRESENT ?? 0) / total) * 100) : 0;
    return { ...s, total, rate };
  });

  if (format === "csv") {
    const header = ["Student", "Admission Number", "Class", "Present", "Absent", "Late", "Excused", "Sick", "Total", "Rate %"];
    const csv = [header, ...rows.map((r) => [
      r.name, r.admissionNumber, r.class ?? "",
      r.counts.PRESENT ?? 0, r.counts.ABSENT ?? 0, r.counts.LATE ?? 0, r.counts.EXCUSED ?? 0, r.counts.SICK ?? 0,
      r.total, r.rate,
    ])].map((r) => r.map(csvCell).join(",")).join("\n");
    return new NextResponse(`\uFEFF${csv}\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ students: rows, totalRecords: attendances.length });
}
