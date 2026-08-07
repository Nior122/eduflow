import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const search = searchParams.get("search");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { schoolId };
  if (classId) where.classId = classId;
  if (status && status !== "all") where.admissionStatus = status;
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { admissionNumber: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const students = await prisma.student.findMany({
    where,
    include: { class: { select: { name: true } }, parent: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "Admission Number", "First Name", "Middle Name", "Last Name", "Gender",
    "Class", "Email", "Phone", "Parent", "Admission Status", "Enrollment Date",
  ];
  const rows = students.map((s) => [
    s.admissionNumber,
    s.firstName,
    s.middleName,
    s.lastName,
    s.gender,
    s.class?.name,
    s.email,
    s.phone,
    s.parent ? `${s.parent.firstName} ${s.parent.lastName}` : "",
    s.admissionStatus,
    s.enrollmentDate.toISOString().slice(0, 10),
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");

  return new NextResponse(`\uFEFF${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
