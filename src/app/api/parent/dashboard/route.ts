import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ["PARENT"]);
  if (denied) return denied;
  const parentId = session?.user?.parentId;
  const schoolId = session?.user?.schoolId;
  if (!parentId || !schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const children = await prisma.student.findMany({
    where: { parentId, schoolId, isActive: true },
    include: {
      class: { select: { name: true } },
      attendances: { orderBy: { date: "desc" }, take: 60 },
      results: { include: { subject: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
      feeRecords: {
        include: { fee: { select: { name: true, amount: true } } },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  return NextResponse.json({
    children: children.map((child) => ({
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
      admissionNumber: child.admissionNumber,
      class: child.class,
      attendances: child.attendances.map((a) => ({ status: a.status, date: a.date.toISOString() })),
      results: child.results.map((r) => ({
        subject: r.subject,
        total: r.total?.toString() ?? "0",
        grade: r.grade ?? "F",
        term: r.term,
      })),
      feeRecords: child.feeRecords.map((f) => ({
        fee: { name: f.fee.name, amount: f.fee.amount.toString() },
        amount: f.amount.toString(),
        status: f.status,
      })),
    })),
  });
}
