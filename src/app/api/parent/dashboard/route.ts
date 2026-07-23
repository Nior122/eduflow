import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.parentId || !session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const children = await prisma.student.findMany({
    where: { parentId: session.user.parentId },
    include: {
      class: { select: { name: true } },
      attendances: { orderBy: { date: "desc" }, take: 60 },
      results: { include: { subject: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
      feeRecords: { include: { fee: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (children.length === 0) {
    return NextResponse.json({ child: null });
  }

  const child = children[0];
  return NextResponse.json({
    child: {
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
      admissionNumber: child.admissionNumber,
      class: child.class,
      attendances: child.attendances.map(a => ({ status: a.status, date: a.date.toISOString() })),
      results: child.results.map(r => ({
        subject: r.subject,
        total: r.total?.toString() || "0",
        grade: r.grade || "F",
        term: r.term,
      })),
      feeRecords: child.feeRecords.map(f => ({
        fee: { name: f.fee.name },
        amount: f.amount.toString(),
        status: f.status,
      })),
    },
  });
}
