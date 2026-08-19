"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Sparkles, Eye, Ban, Send, Plus, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_BADGE } from "@/lib/finance/types";

type Session = { id: string; name: string; terms: { id: string; name: string }[] };
type ClassRow = { id: string; name: string };
type FeeRow = { id: string; name: string; amount: string; feeCategory: { name: string } | null };
type DiscountRow = { id: string; name: string; type: string; value: string; status: string };
type StudentRow = { id: string; firstName: string; lastName: string; admissionNumber: string; class: { name: string } | null };

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: number;
  discountAmount: number;
  paidAmount: number;
  due: number;
  dueDate: string | null;
  student: { firstName: string; lastName: string; admissionNumber: string; class: { name: string } | null };
  items: { id: string; description: string; amount: number }[];
  payments: { id: string; amount: number; payment: { method: string; reference: string; paidAt: string } }[];
  receipts: { id: string; receiptNumber: string }[];
  discount: { name: string } | null;
};

export default function BillingPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [feeIds, setFeeIds] = useState<string[]>([]);
  const [discountId, setDiscountId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [viewing, setViewing] = useState<InvoiceRow | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualStudent, setManualStudent] = useState("");
  const [manualFees, setManualFees] = useState<string[]>([]);
  const [manualNotes, setManualNotes] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/sessions").then((r) => parseJsonBody(r)),
      fetch("/api/admin/classes").then((r) => parseJsonBody(r)),
      fetch("/api/admin/fees").then((r) => parseJsonBody(r)),
      fetch("/api/finance/discounts").then((r) => parseJsonBody(r)),
      fetch("/api/admin/students?limit=200").then((r) => parseJsonBody(r)),
    ]).then(([s, c, f, d, st]) => {
      setSessions(s.sessions ?? []);
      setClasses(c.classes ?? []);
      setFees(f.fees ?? []);
      setDiscounts((d.discounts ?? []).filter((x: DiscountRow) => x.status === "APPROVED" || x.status === "ACTIVE"));
      setStudents(st.students ?? []);
      if (s.sessions?.[0]) {
        setSessionId(s.sessions[0].id);
        setTermId(s.sessions[0].terms?.[0]?.id ?? "");
      }
    }).catch(() => {});
  }, []);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sessionId) params.set("sessionId", sessionId);
      if (termId) params.set("termId", termId);
      if (classId) params.set("classId", classId);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/finance/invoices?${params}`);
      const data = await parseJsonBody(res);
      setInvoices(data.invoices ?? []);
    } finally {
      setLoading(false);
    }
  }, [sessionId, termId, classId, statusFilter, search]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const generate = async () => {
    if (!sessionId || !termId) return toast({ title: "Select session and term", variant: "destructive" });
    setGenerating(true);
    try {
      const res = await fetch("/api/finance/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId, termId,
          classId: classId || undefined,
          feeIds: feeIds.length ? feeIds : undefined,
          discountId: discountId || null,
          dueDate: dueDate || null,
        }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Billing failed");
      toast({ title: `Generated ${data.generated} invoice(s)${data.skipped ? ` · ${data.skipped} skipped (already billed)` : ""}` });
      loadInvoices();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Billing failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const createManual = async () => {
    if (!manualStudent || manualFees.length === 0) {
      return toast({ title: "Select a student and at least one fee", variant: "destructive" });
    }
    setSavingManual(true);
    try {
      const res = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: manualStudent,
          feeIds: manualFees,
          notes: manualNotes || undefined,
          sessionId: sessionId || undefined,
          termId: termId || undefined,
        }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: `Draft invoice ${data.invoice.invoiceNumber} created — issue it when ready` });
      setManualOpen(false);
      setManualStudent(""); setManualFees([]); setManualNotes("");
      loadInvoices();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setSavingManual(false);
    }
  };

  const invoiceAction = async (id: string, path: string, successMsg: string) => {
    try {
      const res = await fetch(`/api/finance/invoices/${id}/${path}`, { method: "POST" });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Action failed");
      toast({ title: successMsg });
      loadInvoices();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Action failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Billing &amp; Invoices</h2>
          <p className="text-sm text-muted-foreground">Bulk-generate invoices per class/term, create manual invoices, issue and cancel.</p>
        </div>
        <Button onClick={() => setManualOpen(true)}><Plus className="h-4 w-4 mr-1" /> Manual invoice</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Session</Label>
              <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setTermId(sessions.find((s) => s.id === v)?.terms?.[0]?.id ?? ""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Term</Label>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sessions.find((s) => s.id === sessionId)?.terms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>Term {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Class</Label>
              <Select value={classId} onValueChange={(v) => setClassId(v === "__all__" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Whole school</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due date (optional)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fees to bill ({feeIds.length} selected — blank = all)</Label>
              <Select value={feeIds.length ? "__sel" : "__all"} onValueChange={(v) => {
                if (v === "__all") setFeeIds([]);
                else if (v === "__sel") setFeeIds(fees.map((f) => f.id));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All applicable fees</SelectItem>
                  <SelectItem value="__sel">Select all {fees.length} fees</SelectItem>
                  {fees.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1">
                {feeIds.length > 0 && <button className="text-[11px] text-primary underline" onClick={() => setFeeIds([])}>clear ({feeIds.length})</button>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Discount / scholarship (optional)</Label>
              <Select value={discountId} onValueChange={(v) => setDiscountId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {discounts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name} ({d.type})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={generate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                {generating ? "Billing…" : "Generate invoices"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{invoices.length} invoice(s)</CardTitle>
          <div className="flex items-center gap-2">
            <Input className="h-9 w-56" placeholder="Search number / student…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All statuses</SelectItem>
                {Object.entries(INVOICE_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No invoices — press Generate.</TableCell></TableRow>
                )}
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">
                      {inv.student.firstName} {inv.student.lastName}
                      <p className="text-xs text-muted-foreground font-mono">{inv.student.admissionNumber}</p>
                    </TableCell>
                    <TableCell className="text-xs">{inv.student.class?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.amount)}</TableCell>
                    <TableCell className="text-right text-amber-600">{inv.discountAmount ? formatCurrency(inv.discountAmount) : "—"}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(inv.paidAmount)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(inv.due - inv.paidAmount)}</TableCell>
                    <TableCell><Badge className={INVOICE_STATUS_BADGE[inv.status as keyof typeof INVOICE_STATUS_BADGE] ?? ""}>{INVOICE_STATUS_LABEL[inv.status as keyof typeof INVOICE_STATUS_LABEL] ?? inv.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setViewing(inv)}><Eye className="h-3.5 w-3.5" /></Button>
                        {inv.status === "DRAFT" && (
                          <Button size="sm" variant="outline" onClick={() => invoiceAction(inv.id, "issue", "Invoice issued")}><Send className="h-3.5 w-3.5" /></Button>
                        )}
                        {inv.status !== "CANCELLED" && inv.status !== "PAID" && (
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => invoiceAction(inv.id, "cancel", "Invoice cancelled")}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoice detail */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Invoice {viewing?.invoiceNumber}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{viewing.student.firstName} {viewing.student.lastName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{viewing.student.admissionNumber} · {viewing.student.class?.name ?? "—"}</p>
                </div>
                <Badge className={INVOICE_STATUS_BADGE[viewing.status as keyof typeof INVOICE_STATUS_BADGE] ?? ""}>{INVOICE_STATUS_LABEL[viewing.status as keyof typeof INVOICE_STATUS_LABEL]}</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewing.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">{item.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">Subtotal</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(viewing.amount)}</TableCell>
                  </TableRow>
                  {viewing.discount && (
                    <TableRow>
                      <TableCell className="text-amber-600">Discount ({viewing.discount.name})</TableCell>
                      <TableCell className="text-right text-amber-600">−{formatCurrency(viewing.discountAmount)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell className="font-bold">Total due</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(viewing.due)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-green-600">Paid</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(viewing.paidAmount)}</TableCell>
                  </TableRow>
                  {viewing.receipts.length > 0 && (
                    <TableRow>
                      <TableCell>Receipts</TableCell>
                      <TableCell className="text-right font-mono text-xs">{viewing.receipts.map((r) => r.receiptNumber).join(", ")}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual invoice */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Manual invoice (draft)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Student</Label>
              <Select value={manualStudent} onValueChange={setManualStudent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fees ({manualFees.length} selected)</Label>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto border rounded-lg p-2">
                {fees.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setManualFees(manualFees.includes(f.id) ? manualFees.filter((x) => x !== f.id) : [...manualFees, f.id])}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${manualFees.includes(f.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"}`}
                  >
                    {f.name} · {formatCurrency(Number(f.amount))}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} />
            </div>
            <Button className="w-full" onClick={createManual} disabled={savingManual}>
              {savingManual && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <FileText className="h-4 w-4 mr-1" /> Create draft invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
