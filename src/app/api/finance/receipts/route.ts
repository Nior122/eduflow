import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { financeGuard } from "@/lib/finance/guards";
import { Prisma } from "@prisma/client";

/**
 * GET /api/finance/receipts — list with filters.
 * ?studentId&search&from&to
 */
export async function GET(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const search = searchParams.get("search");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.ReceiptWhereInput = { student: { schoolId } };
  if (studentId) where.studentId = studentId;
  if (from || to) {
    where.issuedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
    };
  }
  if (search) {
    where.OR = [
      { receiptNumber: { contains: search, mode: "insensitive" } },
      { student: { firstName: { contains: search, mode: "insensitive" } } },
      { student: { lastName: { contains: search, mode: "insensitive" } } },
      { student: { admissionNumber: { contains: search, mode: "insensitive" } } },
    ];
  }

  const receipts = await prisma.receipt.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      invoice: { select: { invoiceNumber: true } },
      receivedBy: { select: { name: true } },
    },
    orderBy: { issuedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({
    receipts: receipts.map((r) => ({ ...r, amount: Number(r.amount) })),
  });
}
