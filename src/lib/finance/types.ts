// ─── Phase 5: finance shared types & helpers ─────────────────────────
import type { DiscountType, InvoiceStatus, PaymentMethod } from "@prisma/client";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIAL: "Partially Paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  OVERDUE: "Overdue",
};

export const INVOICE_STATUS_BADGE: Record<InvoiceStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  ISSUED: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  PARTIAL: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  PAID: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  OVERDUE: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};

export const DISCOUNT_TYPE_LABEL: Record<DiscountType, string> = {
  PERCENTAGE: "Percentage Discount",
  FIXED: "Fixed Amount",
  WAIVER: "Full Waiver",
  SCHOLARSHIP: "Scholarship",
  SIBLING: "Sibling Discount",
  STAFF: "Staff Discount",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CARD: "Card (POS)",
  MOBILE_MONEY: "Mobile Money",
  CHEQUE: "Cheque",
};

export const DISCOUNT_SCOPE_LABEL: Record<string, string> = {
  STUDENT: "Student",
  CLASS: "Class",
  SCHOOL: "Whole School",
  FEE: "Specific Fee",
};

/** Round to 2 decimals (NGN-safe money arithmetic). */
export function money(n: number | string | null | undefined): number {
  return Math.round(Number(n ?? 0) * 100) / 100;
}

/** Percentage-based discount types (value stored as 0-100). */
export function isPercentType(t: DiscountType): boolean {
  return t === "PERCENTAGE" || t === "SCHOLARSHIP" || t === "SIBLING" || t === "STAFF";
}

/** Total due on an invoice = gross amount − discount. */
export function invoiceDue(invoice: { amount: unknown; discountAmount: unknown }): number {
  return money(Number(invoice.amount) - Number(invoice.discountAmount));
}
