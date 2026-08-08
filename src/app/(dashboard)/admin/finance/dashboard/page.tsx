"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Wallet, TrendingUp, AlertTriangle, Users, Percent, Clock } from "lucide-react";

type DashboardData = {
  todayRevenue: number;
  monthRevenue: number;
  outstanding: number;
  studentsOwing: number;
  collectionRate: number;
  todayPayments: number;
  monthPayments: number;
  revenueLast12: { month: string; amount: number }[];
  methodBreakdown: { method: string; amount: number; count: number }[];
  recentPayments: { id: string; reference: string; amount: number; method: string; paidAt: string; studentName: string; admissionNumber: string }[];
  recentReceipts: { id: string; receiptNumber: string; amount: number; issuedAt: string; studentName: string }[];
  overdueInvoices: number;
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash", BANK_TRANSFER: "Bank Transfer", CARD: "Card (POS)", MOBILE_MONEY: "Mobile Money", CHEQUE: "Cheque",
};

export default function FinanceDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/finance/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d.dashboard))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxMonth = Math.max(1, ...(data?.revenueLast12.map((m) => m.amount) ?? [0]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-5 w-5" /> Finance Dashboard</h2>
        <p className="text-sm text-muted-foreground">Real-time revenue, outstanding balances and collection performance.</p>
      </div>

      {loading || !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Today&apos;s revenue</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(data.todayRevenue)}</p>
              <p className="text-xs text-muted-foreground">{data.todayPayments} payment(s)</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Monthly revenue</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(data.monthRevenue)}</p>
              <p className="text-xs text-muted-foreground">{data.monthPayments} payment(s)</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Outstanding fees</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(data.outstanding)}</p>
              <p className="text-xs text-muted-foreground">{data.studentsOwing} student(s) owing</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="h-3 w-3" /> Collection rate</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{data.collectionRate}%</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {data.overdueInvoices} overdue invoice(s)</p>
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue — last 12 months</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end gap-1.5 h-36">
                  {data.revenueLast12.map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${m.month}: ${formatCurrency(m.amount)}`}>
                      <div className="w-full rounded-t bg-primary/80 hover:bg-primary transition-colors" style={{ height: `${Math.max(4, (m.amount / maxMonth) * 100)}%` }} />
                      <span className="text-[9px] text-muted-foreground">{m.month}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Payment methods (this month)</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                {data.methodBreakdown.length === 0 && <p className="text-sm text-muted-foreground">No payments this month.</p>}
                {data.methodBreakdown.map((m) => (
                  <div key={m.method} className="flex items-center gap-3">
                    <span className="w-32 text-xs text-muted-foreground">{METHOD_LABEL[m.method] ?? m.method}</span>
                    <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                      <div className="h-full rounded bg-green-500" style={{ width: `${data.monthRevenue > 0 ? (m.amount / data.monthRevenue) * 100 : 0}%` }} />
                    </div>
                    <span className="w-24 text-xs font-semibold text-right">{formatCurrency(m.amount)} <span className="text-muted-foreground">({m.count})</span></span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Recent payments</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.studentName}</TableCell>
                        <TableCell className="text-xs font-mono">{p.reference}</TableCell>
                        <TableCell><Badge variant="secondary">{METHOD_LABEL[p.method] ?? p.method}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                    {data.recentPayments.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No payments yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Recent receipts</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentReceipts.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-mono">{r.receiptNumber}</TableCell>
                        <TableCell className="text-sm">{r.studentName}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(r.amount)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{new Date(r.issuedAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                    {data.recentReceipts.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No receipts yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
