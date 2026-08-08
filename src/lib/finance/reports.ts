// ─── Phase 5: financial reports + CSV export ─────────────────────────
import { prisma } from "@/lib/db";
import { money } from "./types";
import { recomputeOverdueInvoices, getOutstanding } from "./payments";

export type ReportType =
  | "daily"
  | "weekly"
  | "monthly"
  | "annual"
  | "custom"
  | "outstanding"
  | "discounts"
  | "methods"
  | "cashflow"
  | "class"
  | "department";

export interface FinanceReport {
  type: ReportType;
  title: string;
  generatedAt: Date;
  columns: string[];
  rows: (string | number)[][];
  totals: Record<string, number>;
}

export function toCSV(columns: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function periodKey(date: Date, granularity: "day" | "month"): string {
  return granularity === "day"
    ? date.toISOString().slice(0, 10)
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function getFinanceReport(opts: {
  schoolId: string;
  type: ReportType;
  from?: string | null;
  to?: string | null;
  sessionId?: string | null;
  termId?: string | null;
  classId?: string | null;
}): Promise<FinanceReport> {
  const { schoolId, type } = opts;
  await recomputeOverdueInvoices({ schoolId });

  const now = new Date();
  let from: Date;
  let to: Date;
  let granularity: "day" | "month" = "day";

  switch (type) {
    case "daily":
      from = startOfDay(now);
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case "weekly":
      from = startOfDay(new Date(now.getTime() - 6 * 86_400_000));
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case "monthly":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      granularity = "day";
      break;
    case "annual":
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear() + 1, 0, 1);
      granularity = "month";
      break;
    case "cashflow":
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear() + 1, 0, 1);
      granularity = "month";
      break;
    default:
      from = opts.from ? new Date(opts.from) : new Date(now.getFullYear(), now.getMonth(), 1);
      to = opts.to ? new Date(opts.to) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
      to = new Date(to.getTime() + 86_400_000);
  }

  // ── Revenue series ────────────────────────────────────────────────
  if (type === "daily" || type === "weekly" || type === "monthly" || type === "annual" || type === "custom") {
    const payments = await prisma.payment.findMany({
      where: {
        schoolId,
        status: "PAID",
        paidAt: { gte: from, lte: to },
      },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: "asc" },
    });
    const byPeriod = new Map<string, { amount: number; count: number }>();
    for (const p of payments) {
      const key = periodKey(p.paidAt, granularity);
      const entry = byPeriod.get(key) ?? { amount: 0, count: 0 };
      entry.amount = money(entry.amount + Number(p.amount));
      entry.count += 1;
      byPeriod.set(key, entry);
    }
    const total = money(payments.reduce((s, p) => s + Number(p.amount), 0));
    return {
      type,
      title: `${type === "daily" ? "Daily" : type === "weekly" ? "Weekly" : type === "monthly" ? "Monthly" : type === "annual" ? "Annual" : "Custom"} Revenue`,
      generatedAt: new Date(),
      columns: ["Period", "Amount", "Payments"],
      rows: [...byPeriod.entries()].map(([k, v]) => [k, v.amount.toFixed(2), v.count]),
      totals: { totalRevenue: total, paymentCount: payments.length },
    };
  }

  // ── Outstanding ───────────────────────────────────────────────────
  if (type === "outstanding") {
    const rows = await getOutstanding({
      schoolId,
      classId: opts.classId ?? undefined,
      sessionId: opts.sessionId ?? undefined,
      termId: opts.termId ?? undefined,
    });
    const totalBalance = money(rows.reduce((s, r) => s + r.balance, 0));
    const totalBilled = money(rows.reduce((s, r) => s + r.totalBilled, 0));
    return {
      type,
      title: "Outstanding Fees Report",
      generatedAt: new Date(),
      columns: ["Student", "Admission No", "Class", "Billed", "Paid", "Balance", "Days Late", "Plan"],
      rows: rows.map((r) => [
        r.studentName,
        r.admissionNumber,
        r.className ?? "—",
        r.totalBilled.toFixed(2),
        r.totalPaid.toFixed(2),
        r.balance.toFixed(2),
        r.daysLate,
        r.hasPlan ? "Yes" : "No",
      ]),
      totals: { studentsOwing: rows.length, totalBilled, totalBalance },
    };
  }

  // ── Discounts / scholarships summary ──────────────────────────────
  if (type === "discounts") {
    const invoices = await prisma.invoice.findMany({
      where: { discountId: { not: null }, student: { schoolId } },
      include: { discount: { select: { name: true, type: true } } },
    });
    const byType = new Map<string, { count: number; amount: number }>();
    for (const inv of invoices) {
      const key = inv.discount?.type ?? "OTHER";
      const entry = byType.get(key) ?? { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount = money(entry.amount + Number(inv.discountAmount));
      byType.set(key, entry);
    }
    return {
      type,
      title: "Discounts & Scholarships Summary",
      generatedAt: new Date(),
      columns: ["Discount Type", "Invoices", "Total Discounted"],
      rows: [...byType.entries()].map(([k, v]) => [k, v.count, v.amount.toFixed(2)]),
      totals: { totalDiscounted: money([...byType.values()].reduce((s, v) => s + v.amount, 0)), invoices: invoices.length },
    };
  }

  // ── Payment method breakdown ──────────────────────────────────────
  if (type === "methods") {
    const payments = await prisma.payment.findMany({
      where: { schoolId, status: "PAID", paidAt: { gte: from, lte: to } },
      select: { method: true, amount: true },
    });
    const byMethod = new Map<string, { count: number; amount: number }>();
    for (const p of payments) {
      const entry = byMethod.get(p.method) ?? { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount = money(entry.amount + Number(p.amount));
      byMethod.set(p.method, entry);
    }
    return {
      type,
      title: "Payment Methods Breakdown",
      generatedAt: new Date(),
      columns: ["Method", "Payments", "Amount"],
      rows: [...byMethod.entries()].map(([k, v]) => [k, v.count, v.amount.toFixed(2)]),
      totals: { total: money([...byMethod.values()].reduce((s, v) => s + v.amount, 0)) },
    };
  }

  // ── Cash flow (monthly inflow) ────────────────────────────────────
  if (type === "cashflow") {
    const payments = await prisma.payment.findMany({
      where: { schoolId, status: "PAID", paidAt: { gte: from, lte: to } },
      select: { amount: true, paidAt: true },
    });
    const months = Array.from({ length: 12 }, (_, i) => i);
    const rows = months.map((m) => {
      const monthPayments = payments.filter((p) => p.paidAt.getMonth() === m);
      return [
        new Date(now.getFullYear(), m, 1).toLocaleString("en", { month: "short" }),
        money(monthPayments.reduce((s, p) => s + Number(p.amount), 0)).toFixed(2),
        monthPayments.length,
      ];
    });
    return {
      type,
      title: `Cash Flow ${now.getFullYear()}`,
      generatedAt: new Date(),
      columns: ["Month", "Inflow", "Payments"],
      rows,
      totals: { totalInflow: money(payments.reduce((s, p) => s + Number(p.amount), 0)) },
    };
  }

  // ── Class revenue ─────────────────────────────────────────────────
  if (type === "class") {
    const allocations = await prisma.invoicePayment.findMany({
      where: {
        payment: { schoolId, status: "PAID", paidAt: { gte: from, lte: to } },
      },
      include: { invoice: { include: { student: { include: { class: { select: { name: true } } } } } } },
    });
    const byClass = new Map<string, number>();
    for (const a of allocations) {
      const name = a.invoice.student.class?.name ?? "Unassigned";
      byClass.set(name, money((byClass.get(name) ?? 0) + Number(a.amount)));
    }
    return {
      type,
      title: "Revenue by Class",
      generatedAt: new Date(),
      columns: ["Class", "Revenue"],
      rows: [...byClass.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v.toFixed(2)]),
      totals: { total: money([...byClass.values()].reduce((s, v) => s + v, 0)) },
    };
  }

  // ── Department revenue ────────────────────────────────────────────
  if (type === "department") {
    const items = await prisma.invoiceItem.findMany({
      where: { fee: { departmentId: { not: null } }, invoice: { student: { schoolId } } },
      include: { fee: { include: { department: { select: { name: true } } } }, invoice: { select: { status: true, paidAmount: true } } },
    });
    // attribute paid amounts proportionally to item gross share
    const totals = new Map<string, number>();
    const invoicesById = new Map<string, { status: string; paidAmount: number }>();
    for (const it of items) invoicesById.set(it.invoiceId, { status: it.invoice.status, paidAmount: Number(it.invoice.paidAmount) });
    const itemSumByInvoice = new Map<string, number>();
    for (const it of items) itemSumByInvoice.set(it.invoiceId, money((itemSumByInvoice.get(it.invoiceId) ?? 0) + Number(it.amount)));
    for (const it of items) {
      const inv = invoicesById.get(it.invoiceId);
      if (!inv || inv.status === "CANCELLED") continue;
      const share = itemSumByInvoice.get(it.invoiceId) && itemSumByInvoice.get(it.invoiceId)! > 0
        ? Number(it.amount) / itemSumByInvoice.get(it.invoiceId)!
        : 0;
      const contribution = money(Number(inv.paidAmount) * share);
      const dept = it.fee?.department?.name ?? "Unassigned";
      totals.set(dept, money((totals.get(dept) ?? 0) + contribution));
    }
    return {
      type,
      title: "Revenue by Department",
      generatedAt: new Date(),
      columns: ["Department", "Revenue"],
      rows: [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v.toFixed(2)]),
      totals: { total: money([...totals.values()].reduce((s, v) => s + v, 0)) },
    };
  }

  throw new Error(`Unsupported report type: ${type}`);
}
