// ─── Phase 5: receipts ───────────────────────────────────────────────
import { prisma } from "@/lib/db";

export interface ReceiptData {
  receipt: {
    id: string;
    receiptNumber: string;
    amount: number;
    method: string;
    issuedAt: Date;
    qrCode: string;
    notes: string | null;
  };
  student: {
    firstName: string;
    lastName: string;
    admissionNumber: string;
    gender: string | null;
  };
  school: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo: string | null;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: number;
    discountAmount: number;
    paidAmount: number;
    status: string;
  } | null;
  receivedBy: string | null;
}

export async function getReceiptData(opts: { receiptId: string; schoolId: string }): Promise<ReceiptData | null> {
  const row = await prisma.receipt.findFirst({
    where: { id: opts.receiptId, student: { schoolId: opts.schoolId } },
    include: {
      student: { include: { school: true } },
      receivedBy: { select: { name: true } },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          discountAmount: true,
          paidAmount: true,
          status: true,
        },
      },
    },
  });
  if (!row) return null;

  return {
    receipt: {
      id: row.id,
      receiptNumber: row.receiptNumber,
      amount: Number(row.amount),
      method: row.method,
      issuedAt: row.issuedAt,
      qrCode: row.qrCode,
      notes: row.notes,
    },
    student: {
      firstName: row.student.firstName,
      lastName: row.student.lastName,
      admissionNumber: row.student.admissionNumber,
      gender: row.student.gender,
    },
    school: {
      name: row.student.school.name,
      address: row.student.school.address,
      phone: row.student.school.phone,
      email: row.student.school.email,
      logo: row.student.school.logo,
    },
    invoice: row.invoice
      ? {
          id: row.invoice.id,
          invoiceNumber: row.invoice.invoiceNumber,
          amount: Number(row.invoice.amount),
          discountAmount: Number(row.invoice.discountAmount),
          paidAmount: Number(row.invoice.paidAmount),
          status: row.invoice.status,
        }
      : null,
    receivedBy: row.receivedBy?.name ?? null,
  };
}

/** QR-code verification for receipts (architecture-ready, like report cards). */
export async function verifyReceiptByCode(opts: { code: string }) {
  const row = await prisma.receipt.findUnique({
    where: { qrCode: opts.code },
    include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
  });
  if (!row) return null;
  return {
    verified: true,
    receiptNumber: row.receiptNumber,
    studentName: `${row.student.firstName} ${row.student.lastName}`,
    admissionNumber: row.student.admissionNumber,
    amount: Number(row.amount),
    method: row.method,
    issuedAt: row.issuedAt,
  };
}
