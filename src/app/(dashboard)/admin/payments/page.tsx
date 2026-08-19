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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, ReceiptText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance/types";

type PaymentRow = {
  id: string;
  reference: string;
  method: string;
  status: string;
  amount: number;
  paidAt: string;
  notes: string | null;
  receivedBy: { name: string | null } | null;
  receipt: { id: string; receiptNumber: string } | null;
  invoicePayments: { invoiceId: string; invoiceNumber: string; amount: number; studentName: string; admissionNumber: string }[];
};

type StudentOption = { id: string; firstName: string; lastName: string; admissionNumber: string };
type OpenInvoice = { id: string; invoiceNumber: string; due: number; paidAmount: number; status: string };

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [methodFilter, setMethodFilter] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [payStudent, setPayStudent] = useState("");
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [payForm, setPayForm] = useState({ amount: "", method: "CASH", reference: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/students?limit=200").then((r) => parseJsonBody(r)).then((d) => setStudents(d.students ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (methodFilter) params.set("method", methodFilter);
      if (search) params.set("search", search);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/finance/payments?${params}`);
      const data = await parseJsonBody(res);
      setPayments(data.payments ?? []);
    } finally {
      setLoading(false);
    }
  }, [methodFilter, search, from, to]);

  useEffect(() => { load(); }, [load]);

  const pickStudent = async (studentId: string) => {
    setPayStudent(studentId);
    setSelectedInvoices([]);
    if (!studentId) return;
    try {
      const res = await fetch(`/api/finance/invoices?studentId=${studentId}&status=ISSUED`);
      const data = await parseJsonBody(res);
      const issued = data.invoices ?? [];
      const partial = await fetch(`/api/finance/invoices?studentId=${studentId}&status=PARTIAL`).then((r) => parseJsonBody(r));
      const overdue = await fetch(`/api/finance/invoices?studentId=${studentId}&status=OVERDUE`).then((r) => parseJsonBody(r));
      const all = [...issued, ...(partial.invoices ?? []), ...(overdue.invoices ?? [])].map((i: OpenInvoice) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        due: Number(i.due) - Number(i.paidAmount),
        paidAmount: Number(i.paidAmount),
        status: i.status,
      }));
      setOpenInvoices(all.filter((i) => i.due > 0));
    } catch {
      setOpenInvoices([]);
    }
  };

  const save = async () => {
    if (!payForm.amount || !payForm.reference) {
      return toast({ title: "Amount and reference are required", variant: "destructive" });
    }
    setSaving(true);
    try {
      const res = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(payForm.amount),
          method: payForm.method,
          reference: payForm.reference,
          invoiceIds: selectedInvoices.length ? selectedInvoices : undefined,
          studentId: selectedInvoices.length ? undefined : payStudent || undefined,
          notes: payForm.notes || undefined,
        }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Payment failed");
      toast({
        title: `Payment recorded — receipt ${data.receipt.receiptNumber} generated`,
        description: data.allocations?.map((a: { invoiceNumber: string; amount: number; statusAfter: string }) => `${a.invoiceNumber}: ${formatCurrency(a.amount)} → ${a.statusAfter}`).join(" · "),
      });
      setPayOpen(false);
      setPayForm({ amount: "", method: "CASH", reference: "", notes: "" });
      setPayStudent("");
      setOpenInvoices([]);
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Payment failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const outstandingForSelected = openInvoices.filter((i) => selectedInvoices.includes(i.id)).reduce((s, i) => s + i.due, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payments</h2>
          <p className="text-sm text-muted-foreground">Record cash/bank/POS/cheque/mobile payments. Receipts are generated automatically.</p>
        </div>
        <Button onClick={() => setPayOpen(true)}><Plus className="h-4 w-4 mr-1" /> Record payment</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Method</Label>
              <Select value={methodFilter} onValueChange={(v) => setMethodFilter(v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All methods</SelectItem>
                  {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reference</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. TFR-…" />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={load} disabled={loading}>Refresh</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{payments.length} payment(s)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Student / Invoice</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                  <TableHead>Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No payments found.</TableCell></TableRow>
                )}
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                    <TableCell>
                      {p.invoicePayments.map((ip) => (
                        <p key={ip.invoiceId} className="text-sm">
                          {ip.studentName} <span className="text-xs text-muted-foreground font-mono">· {ip.invoiceNumber} · {formatCurrency(ip.amount)}</span>
                        </p>
                      ))}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL] ?? p.method}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(p.amount)}</TableCell>
                    <TableCell className="text-xs">{p.receivedBy?.name ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {p.receipt ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/receipts/${p.receipt.id}`} target="_blank">
                            <ReceiptText className="h-3.5 w-3.5 mr-1" /> {p.receipt.receiptNumber}
                          </Link>
                        </Button>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Student (optional — leave blank if invoices selected below)</Label>
              <Select value={payStudent} onValueChange={pickStudent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {openInvoices.length > 0 && (
              <div className="space-y-1.5">
                <Label>Open invoices ({formatCurrency(outstandingForSelected)} selected)</Label>
                <div className="space-y-1 max-h-36 overflow-y-auto border rounded-lg p-2">
                  {openInvoices.map((i) => (
                    <label key={i.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-2 py-1">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={selectedInvoices.includes(i.id)}
                        onChange={(e) => setSelectedInvoices(e.target.checked ? [...selectedInvoices, i.id] : selectedInvoices.filter((x) => x !== i.id))}
                      />
                      <span className="font-mono text-xs">{i.invoiceNumber}</span>
                      <span className="text-xs text-muted-foreground">{i.status}</span>
                      <span className="ml-auto font-medium text-xs">{formatCurrency(i.due)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (₦)</Label>
                <Input type="number" min={0.01} step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Reference (unique)</Label>
                <Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="e.g. TFR-2026-001" />
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
              </div>
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              {saving ? "Recording…" : "Record payment & generate receipt"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
