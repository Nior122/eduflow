"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Printer, ArrowLeft, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance/types";

type ReceiptData = {
  receipt: { id: string; receiptNumber: string; amount: number; method: string; issuedAt: string; qrCode: string; notes: string | null };
  student: { firstName: string; lastName: string; admissionNumber: string; gender: string | null };
  school: { name: string; address: string | null; phone: string | null; email: string | null; logo: string | null };
  invoice: { invoiceNumber: string; amount: number; discountAmount: number; paidAmount: number; status: string } | null;
  receivedBy: string | null;
};

export default function ReceiptPrintPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/finance/receipts/${params.id}`)
      .then(async (r) => {
        const d = await parseJsonBody(r);
        if (!r.ok) throw new Error(d.error || "Receipt not found");
        return d;
      })
      .then((d) => setData(d.receipt))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [params.id]);

  const verify = async () => {
    if (!data) return;
    try {
      const res = await fetch(`/api/finance/receipts/verify?code=${data.receipt.qrCode}`);
      const d = await parseJsonBody(res);
      if (!res.ok) throw new Error(d.error || "Verification failed");
      toast({ title: `Verified: ${d.studentName} · ${formatCurrency(d.amount)}` });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Verification failed", variant: "destructive" });
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center space-y-3">
          <p className="font-semibold text-destructive">{error}</p>
          <Link href="/admin/receipts"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" /> Back to receipts</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 p-4 sm:p-8 print:bg-white print:p-0">
      <div className="max-w-xl mx-auto space-y-4 print:space-y-0">
        <div className="flex items-center justify-between print:hidden">
          <Link href="/admin/receipts">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={verify} disabled={!data}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Verify QR
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Print / Save PDF
            </Button>
          </div>
        </div>

        {!data ? (
          <Card className="p-12 space-y-3">
            <Skeleton className="h-6 w-1/3 mx-auto" />
            <Skeleton className="h-44 w-full" />
          </Card>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border print:shadow-none">
            <div className="border-b-2 border-dashed px-6 py-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {data.school.logo ? <img src={data.school.logo} alt="" className="h-full w-full object-contain" /> : "🎓"}
                </div>
                <div>
                  <h1 className="text-lg font-bold">{data.school.name}</h1>
                  <p className="text-xs text-muted-foreground">{data.school.address ?? ""}</p>
                  <p className="text-xs text-muted-foreground">{data.school.phone ?? ""}{data.school.email ? ` · ${data.school.email}` : ""}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">OFFICIAL RECEIPT</p>
                <p className="font-mono text-sm">{data.receipt.receiptNumber}</p>
                <p className="text-xs text-muted-foreground">{new Date(data.receipt.issuedAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-dashed">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Received from</p>
                <p className="font-semibold text-sm">{data.student.firstName} {data.student.lastName}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Admission No</p>
                <p className="font-mono text-sm">{data.student.admissionNumber}</p>
              </div>
            </div>

            <div className="px-6 py-4">
              <table className="w-full text-sm">
                <tbody>
                  {data.invoice && (
                    <tr>
                      <td className="py-1.5 text-muted-foreground">Invoice</td>
                      <td className="py-1.5 text-right font-mono">{data.invoice.invoiceNumber}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-1.5 text-muted-foreground">Payment method</td>
                    <td className="py-1.5 text-right font-medium">{PAYMENT_METHOD_LABEL[data.receipt.method as keyof typeof PAYMENT_METHOD_LABEL] ?? data.receipt.method}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-muted-foreground">Cashier</td>
                    <td className="py-1.5 text-right">{data.receivedBy ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-muted-foreground">Amount paid</td>
                    <td className="py-1.5 text-right font-bold text-lg">{formatCurrency(data.receipt.amount)}</td>
                  </tr>
                  {data.invoice && (
                    <tr>
                      <td className="py-1.5 text-muted-foreground">Outstanding balance on invoice</td>
                      <td className="py-1.5 text-right font-semibold text-amber-600">
                        {formatCurrency(Math.max(0, Number(data.invoice.amount) - Number(data.invoice.discountAmount) - Number(data.invoice.paidAmount)))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {data.receipt.notes && (
                <p className="text-xs text-muted-foreground mt-2 border-t border-dashed pt-2">{data.receipt.notes}</p>
              )}
            </div>

            <div className="px-6 py-4 flex items-end justify-between border-t-2 border-dashed">
              <div>
                <p className="text-[10px] text-muted-foreground">Authorized signature</p>
                <p className="mt-8 border-b border-foreground/30 w-40 text-center text-xs">____________________</p>
              </div>
              <div className="text-center">
                <svg viewBox="0 0 40 40" className="h-12 w-12 text-muted-foreground/60 mx-auto">
                  <rect x="2" y="2" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" />
                  <rect x="8" y="8" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M14 22 20 12l6 10M14 26h12" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
                <button onClick={verify} className="text-[9px] font-mono text-primary underline print:hidden">
                  {data.receipt.qrCode.slice(0, 8)}… verify
                </button>
                <span className="text-[9px] font-mono text-muted-foreground hidden print:inline">{data.receipt.qrCode}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
