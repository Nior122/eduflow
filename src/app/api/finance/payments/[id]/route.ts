import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { financeGuard } from "@/lib/finance/guards";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  const payment = await prisma.payment.findFirst({
    where: { id, schoolId },
    include: {
      invoicePayments: { include: { invoice: { include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } } } } },
      receipt: true,
      receivedBy: { select: { name: true } },
    },
  });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  return NextResponse.json({
    payment: {
      ...payment,
      amount: Number(payment.amount),
      invoicePayments: payment.invoicePayments.map((ip) => ({
        ...ip,
        amount: Number(ip.amount),
        invoiceNumber: ip.invoice.invoiceNumber,
        studentName: `${ip.invoice.student.firstName} ${ip.invoice.student.lastName}`,
        admissionNumber: ip.invoice.student.admissionNumber,
      })),
    },
  });
}
