// ─── Phase 5: finance dashboard ──────────────────────────────────────
import { prisma } from "@/lib/db";
import { money } from "./types";
import { recomputeOverdueInvoices } from "./payments";

export interface FinanceDashboard {
  todayRevenue: number;
  monthRevenue: number;
  outstanding: number;
  studentsOwing: number;
  collectionRate: number;
  todayPayments: number;
  monthPayments: number;
  revenueLast12: { month: string; amount: number }[];
  methodBreakdown: { method: string; amount: number; count: number }[];
  recentPayments: {
    id: string;
    reference: string;
    amount: number;
    method: string;
    paidAt: Date;
    studentName: string;
    admissionNumber: string;
  }[];
  recentReceipts: {
    id: string;
    receiptNumber: string;
    amount: number;
    issuedAt: Date;
    studentName: string;
  }[];
  overdueInvoices: number;
}

export async function getFinanceDashboard(opts: { schoolId: string }): Promise<FinanceDashboard> {
  await recomputeOverdueInvoices({ schoolId: opts.schoolId });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);

  const [todayPayments, monthPayments, openInvoices, allInvoices, yearPayments, recentPayments, recentReceipts, overdueCount] =
    await Promise.all([
      prisma.payment.findMany({
        where: { schoolId: opts.schoolId, status: "PAID", paidAt: { gte: todayStart } },
        select: { amount: true },
      }),
      prisma.payment.findMany({
        where: { schoolId: opts.schoolId, status: "PAID", paidAt: { gte: monthStart } },
        select: { amount: true, method: true },
      }),
      prisma.invoice.findMany({
        where: { status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] }, student: { schoolId: opts.schoolId } },
        select: { amount: true, discountAmount: true, paidAmount: true, studentId: true },
      }),
      prisma.invoice.findMany({
        where: { status: { not: "CANCELLED" }, student: { schoolId: opts.schoolId } },
        select: { amount: true, discountAmount: true, paidAmount: true },
      }),
      prisma.payment.findMany({
        where: { schoolId: opts.schoolId, status: "PAID", paidAt: { gte: yearStart } },
        select: { amount: true, paidAt: true },
      }),
      prisma.payment.findMany({
        where: { schoolId: opts.schoolId, status: "PAID" },
        include: { invoicePayments: { include: { invoice: { include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } } } }, take: 1 } },
        orderBy: { paidAt: "desc" },
        take: 6,
      }),
      prisma.receipt.findMany({
        where: { student: { schoolId: opts.schoolId } },
        include: { student: { select: { firstName: true, lastName: true } } },
        orderBy: { issuedAt: "desc" },
        take: 6,
      }),
      prisma.invoice.count({
        where: { status: "OVERDUE", student: { schoolId: opts.schoolId } },
      }),
    ]);

  const todayRevenue = money(todayPayments.reduce((s, p) => s + Number(p.amount), 0));
  const monthRevenue = money(monthPayments.reduce((s, p) => s + Number(p.amount), 0));
  const outstanding = money(openInvoices.reduce((s, i) => s + Number(i.amount) - Number(i.discountAmount) - Number(i.paidAmount), 0));
  const studentsOwing = new Set(openInvoices.map((i) => i.studentId)).size;

  const totalBilled = money(allInvoices.reduce((s, i) => s + Number(i.amount) - Number(i.discountAmount), 0));
  const totalPaid = money(allInvoices.reduce((s, i) => s + Number(i.paidAmount), 0));
  const collectionRate = totalBilled > 0 ? money((totalPaid / totalBilled) * 100) : 0;

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear() - (i > now.getMonth() ? 1 : 0), (i + 1) % 12, 1);
    return d;
  }).reverse();
  const revenueLast12 = months.map((m) => {
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    const amount = money(
      yearPayments.filter((p) => p.paidAt >= m && p.paidAt < next).reduce((s, p) => s + Number(p.amount), 0)
    );
    return { month: m.toLocaleString("en", { month: "short" }), amount };
  });

  const byMethod = new Map<string, { amount: number; count: number }>();
  for (const p of monthPayments) {
    const entry = byMethod.get(p.method) ?? { amount: 0, count: 0 };
    entry.amount = money(entry.amount + Number(p.amount));
    entry.count += 1;
    byMethod.set(p.method, entry);
  }

  return {
    todayRevenue,
    monthRevenue,
    outstanding,
    studentsOwing,
    collectionRate,
    todayPayments: todayPayments.length,
    monthPayments: monthPayments.length,
    revenueLast12,
    methodBreakdown: [...byMethod.entries()].map(([method, v]) => ({ method, amount: v.amount, count: v.count })),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      reference: p.reference,
      amount: Number(p.amount),
      method: p.method,
      paidAt: p.paidAt,
      studentName: p.invoicePayments[0]?.invoice.student
        ? `${p.invoicePayments[0].invoice.student.firstName} ${p.invoicePayments[0].invoice.student.lastName}`
        : "—",
      admissionNumber: p.invoicePayments[0]?.invoice.student?.admissionNumber ?? "—",
    })),
    recentReceipts: recentReceipts.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      amount: Number(r.amount),
      issuedAt: r.issuedAt,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
    })),
    overdueInvoices: overdueCount,
  };
}
