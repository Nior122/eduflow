"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Printer, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance/types";

type ReceiptRow = {
  id: string;
  receiptNumber: string;
  amount: number;
  method: string;
  issuedAt: string;
  qrCode: string;
  student: { firstName: string; lastName: string; admissionNumber: string };
  invoice: { invoiceNumber: string } | null;
  receivedBy: { name: string | null } | null;
};

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/finance/receipts?${params}`);
      const data = await res.json();
      setReceipts(data.receipts ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, from, to]);

  useEffect(() => { load(); }, [load]);

  const verify = async (r: ReceiptRow) => {
    try {
      const res = await fetch(`/api/finance/receipts/verify?code=${r.qrCode}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      toast({ title: `Verified: ${data.studentName} · ${formatCurrency(data.amount)}` });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Verification failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Receipts</h2>
        <p className="text-sm text-muted-foreground">Every payment generates a numbered receipt with a QR verification code.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Search</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Receipt no / student…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={load} disabled={loading}>Refresh</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{receipts.length} receipt(s)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No receipts yet.</TableCell></TableRow>
                )}
                {receipts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.receiptNumber}</TableCell>
                    <TableCell className="text-sm">
                      {r.student.firstName} {r.student.lastName}
                      <p className="text-xs text-muted-foreground font-mono">{r.student.admissionNumber}</p>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.invoice?.invoiceNumber ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{PAYMENT_METHOD_LABEL[r.method as keyof typeof PAYMENT_METHOD_LABEL] ?? r.method}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(r.amount)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{new Date(r.issuedAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => verify(r)}><ShieldCheck className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" asChild>
                          <Link href={`/receipts/${r.id}`} target="_blank"><Printer className="h-3.5 w-3.5 mr-1" /> Print</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
