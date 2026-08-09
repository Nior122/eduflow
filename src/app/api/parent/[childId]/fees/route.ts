import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getChildForParent } from "@/lib/portal";

const PARENT_ROLES = ["PARENT"] as const;

type RouteCtx = { params: Promise<{ childId: string }> };

/** GET /api/parent/[childId]/fees — fee status, balance and payment history for one child. */
export async function GET(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, PARENT_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const parentId = session?.user?.parentId;
  const schoolId = session?.user?.schoolId;
  if (!parentId || !schoolId) {
    return NextResponse.json({ error: "Parent profile not found" }, { status: 404 });
  }

  const { childId } = await params;
  const child = await getChildForParent(parentId, schoolId, childId);
  if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });

  const [feeRecords, payments] = await Promise.all([
    prisma.feeRecord.findMany({
      where: { studentId: childId },
      include: { fee: { select: { name: true, amount: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { schoolId, feeRecords: { some: { studentId: childId } } },
      include: {
        receipt: {
          select: { id: true, receiptNumber: true, amount: true, method: true, issuedAt: true, notes: true },
        },
      },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  const outstanding = feeRecords
    .filter((f) => !["PAID", "WAIVED"].includes(f.status))
    .reduce((sum, f) => sum + Number(f.amount), 0);
  const paidTotal = feeRecords
    .filter((f) => f.status === "PAID")
    .reduce((sum, f) => sum + Number(f.amount), 0);

  return NextResponse.json({
    child: { id: child.id, firstName: child.firstName, lastName: child.lastName, className: child.class?.name ?? null },
    summary: {
      outstanding,
      paidTotal,
      totalAssessed: feeRecords.reduce((sum, f) => sum + Number(f.amount), 0),
      unpaidCount: feeRecords.filter((f) => !["PAID", "WAIVED"].includes(f.status)).length,
    },
    feeRecords: feeRecords.map((f) => ({
      id: f.id,
      feeName: f.fee.name,
      amount: Number(f.amount),
      status: f.status,
      dueDate: f.dueDate?.toISOString() ?? null,
      paidAt: f.paidAt?.toISOString() ?? null,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      reference: p.reference,
      status: p.status,
      paidAt: p.paidAt.toISOString(),
      notes: p.notes,
      receipt: p.receipt
        ? {
            id: p.receipt.id,
            receiptNumber: p.receipt.receiptNumber,
            amount: Number(p.receipt.amount),
            method: p.receipt.method,
            issuedAt: p.receipt.issuedAt.toISOString(),
            notes: p.receipt.notes,
          }
        : null,
    })),
  });
}
