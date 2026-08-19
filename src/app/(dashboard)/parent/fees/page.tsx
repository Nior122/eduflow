"use client";

import { useCallback, useEffect, useState } from "react";
import { DollarSign, Receipt, Wallet, AlertTriangle, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChildSelect } from "@/components/portal/child-select";
import { useChildren } from "@/hooks/use-children";
import { formatCurrency, formatDate } from "@/lib/utils";

type FeesData = {
  child: { firstName: string; lastName: string; className: string | null };
  summary: { outstanding: number; paidTotal: number; totalAssessed: number; unpaidCount: number };
  feeRecords: { id: string; feeName: string; amount: number; status: string; dueDate: string | null; paidAt: string | null }[];
  payments: {
    id: string;
    amount: number;
    method: string;
    reference: string;
    status: string;
    paidAt: string;
    notes: string | null;
    receipt: { id: string; receiptNumber: string; amount: number; method: string; issuedAt: string; notes: string | null } | null;
  }[];
};

export default function ParentFeesPage() {
  const { children, selectedId, setSelectedId, loading } = useChildren();
  const [data, setData] = useState<FeesData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [printReceipt, setPrintReceipt] = useState<FeesData["payments"][number]["receipt"] | null>(null);

  const load = useCallback(async (childId: string) => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/parent/${childId}/fees`);
      const d = await parseJsonBody(res);
      if (res.ok) setData(d);
    } catch {
      /* ignore */
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) load(selectedId);
  }, [selectedId, load]);

  const statusColor = (s: string) =>
    s === "PAID" ? "bg-emerald-500/15 text-emerald-600" :
    s === "WAIVED" ? "bg-muted text-muted-foreground" :
    s === "PARTIAL" ? "bg-amber-500/15 text-amber-600" :
    s === "OVERDUE" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" /> Fees & Receipts
          </h2>
          <p className="text-muted-foreground">Fee status and payment history</p>
        </div>
        <ChildSelect children={children} selectedId={selectedId} onSelect={setSelectedId} loading={loading} />
      </div>

      {dataLoading ? (
        <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /></div>
      ) : !data ? (
        <p className="text-muted-foreground">No fee data available.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Outstanding balance</p>
                <p className="mt-1 text-3xl font-bold text-destructive">{formatCurrency(data.summary.outstanding)}</p>
                <p className="text-xs text-muted-foreground mt-1">{data.summary.unpaidCount} unpaid item(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Total paid</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">{formatCurrency(data.summary.paidTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Total assessed</p>
                <p className="mt-1 text-3xl font-bold">{formatCurrency(data.summary.totalAssessed)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Fee items</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fee</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.feeRecords.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No fee items assigned</TableCell></TableRow>
                  ) : (
                    data.feeRecords.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.feeName}</TableCell>
                        <TableCell>{formatCurrency(f.amount)}</TableCell>
                        <TableCell><Badge className={statusColor(f.status)}>{f.status}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{f.dueDate ? formatDate(f.dueDate) : "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Payment history</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No payments recorded</TableCell></TableRow>
                  ) : (
                    data.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.paidAt)}</TableCell>
                        <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                        <TableCell>{p.method.replace(/_/g, " ")}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(p.amount)}</TableCell>
                        <TableCell>
                          {p.receipt ? (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPrintReceipt(p.receipt)}>
                              <Printer className="mr-1 h-3 w-3" /> {p.receipt.receiptNumber}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.summary.unpaidCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>You have {data.summary.unpaidCount} unpaid fee item(s). Contact the school office to arrange payment.</span>
            </div>
          )}

          {/* Receipt print dialog */}
          {printReceipt && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPrintReceipt(null)}>
              <div className="w-full max-w-sm rounded-xl bg-white p-6 text-black shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="text-center border-b border-dashed pb-3">
                  <p className="text-lg font-bold">EduFlow School</p>
                  <p className="text-xs text-gray-500">Official Payment Receipt</p>
                </div>
                <div className="space-y-2 py-4 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Receipt No</span><span className="font-mono font-medium">{printReceipt.receiptNumber}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-bold">{formatCurrency(printReceipt.amount)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Method</span><span>{printReceipt.method.replace(/_/g, " ")}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Issued</span><span>{formatDate(printReceipt.issuedAt)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Student</span><span>{data.child.firstName} {data.child.lastName}</span></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setPrintReceipt(null)}>Close</Button>
                  <Button variant="gradient" className="flex-1" onClick={() => window.print()}>Print</Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
