"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Loader2, Bell, CalendarClock, CheckCircle2, XCircle, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Session = { id: string; name: string; terms: { id: string; name: string }[] };
type ClassRow = { id: string; name: string };
type StudentRow = { id: string; firstName: string; lastName: string; admissionNumber: string };

type OutstandingRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  totalBilled: number;
  totalPaid: number;
  balance: number;
  daysLate: number;
  hasPlan: boolean;
  invoices: { id: string; invoiceNumber: string; amount: number; discountAmount: number; paidAmount: number; status: string; dueDate: string | null }[];
};

type PlanRow = {
  id: string;
  totalAmount: number;
  installmentAmount: number;
  installmentCount: number;
  frequency: string;
  status: string;
  dueDate: string | null;
  student: { firstName: string; lastName: string; admissionNumber: string };
  invoice: { invoiceNumber: string } | null;
};

export default function OutstandingPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [defaultersOnly, setDefaultersOnly] = useState(false);
  const [rows, setRows] = useState<OutstandingRow[]>([]);
  const [totals, setTotals] = useState({ studentsOwing: 0, totalBilled: 0, totalBalance: 0 });
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ studentId: "", totalAmount: "", installmentAmount: "", installmentCount: "4", frequency: "MONTHLY", dueDate: "" });
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/sessions").then((r) => parseJsonBody(r)),
      fetch("/api/admin/classes").then((r) => parseJsonBody(r)),
      fetch("/api/admin/students?limit=200").then((r) => parseJsonBody(r)),
    ]).then(([s, c, st]) => {
      setSessions(s.sessions ?? []);
      setClasses(c.classes ?? []);
      setStudents(st.students ?? []);
      if (s.sessions?.[0]) {
        setSessionId(s.sessions[0].id);
        setTermId(s.sessions[0].terms?.[0]?.id ?? "");
      }
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (classId) params.set("classId", classId);
      if (sessionId) params.set("sessionId", sessionId);
      if (termId) params.set("termId", termId);
      if (defaultersOnly) params.set("defaulters", "1");
      const [oRes, pRes] = await Promise.all([
        fetch(`/api/finance/outstanding?${params}`).then((r) => parseJsonBody(r)),
        fetch(`/api/finance/plans?${classId ? `studentId=${classId}` : ""}`).then((r) => parseJsonBody(r)).catch(() => ({ plans: [] })),
      ]);
      setRows(oRes.rows ?? []);
      setTotals(oRes.totals ?? { studentsOwing: 0, totalBilled: 0, totalBalance: 0 });
      setPlans(pRes.plans ?? []);
    } finally {
      setLoading(false);
    }
  }, [classId, sessionId, termId, defaultersOnly]);

  const sendReminders = async () => {
    const invoiceIds = rows.flatMap((r) => r.invoices.map((i) => i.id));
    if (invoiceIds.length === 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/finance/outstanding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: `Reminders queued for ${data.sent} invoice(s)` });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const savePlan = async () => {
    if (!planForm.studentId || !planForm.totalAmount || !planForm.installmentAmount) {
      return toast({ title: "Student, total and installment amount required", variant: "destructive" });
    }
    setSavingPlan(true);
    try {
      const res = await fetch("/api/finance/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: planForm.studentId,
          totalAmount: parseFloat(planForm.totalAmount),
          installmentAmount: parseFloat(planForm.installmentAmount),
          installmentCount: parseInt(planForm.installmentCount),
          frequency: planForm.frequency,
          dueDate: planForm.dueDate || null,
        }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Payment plan created" });
      setPlanOpen(false);
      setPlanForm({ studentId: "", totalAmount: "", installmentAmount: "", installmentCount: "4", frequency: "MONTHLY", dueDate: "" });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setSavingPlan(false);
    }
  };

  const planAction = async (id: string, status: "COMPLETED" | "CANCELLED") => {
    try {
      const res = await fetch(`/api/finance/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: `Plan ${status.toLowerCase()}` });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Outstanding Fees &amp; Payment Plans</h2>
          <p className="text-sm text-muted-foreground">Defaulters, partial payments, plans and late-payment reminders.</p>
        </div>
        <Button onClick={() => setPlanOpen(true)}><Plus className="h-4 w-4 mr-1" /> New payment plan</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
              <Select value={classId} onValueChange={(v) => setClassId(v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All classes</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-end pb-2 text-sm gap-2">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={defaultersOnly} onChange={(e) => setDefaultersOnly(e.target.checked)} />
              Defaulters only
            </label>
            <div className="flex items-end gap-2">
              <Button onClick={load} disabled={loading}>Load</Button>
              <Button variant="outline" onClick={sendReminders} disabled={sending || rows.length === 0}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4 mr-1" />} Remind all
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Students owing</p><p className="text-2xl font-bold">{totals.studentsOwing}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Total billed</p><p className="text-2xl font-bold">{formatCurrency(totals.totalBilled)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Outstanding balance</p><p className="text-2xl font-bold text-amber-600">{formatCurrency(totals.totalBalance)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Outstanding list</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Days late</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Invoices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No outstanding fees 🎉</TableCell></TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.studentId}>
                    <TableCell>
                      <p className="font-medium text-sm">{r.studentName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.admissionNumber}</p>
                    </TableCell>
                    <TableCell className="text-xs">{r.className ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.totalBilled)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(r.totalPaid)}</TableCell>
                    <TableCell className="text-right font-bold text-amber-600">{formatCurrency(r.balance)}</TableCell>
                    <TableCell className="text-right">{r.daysLate > 0 ? <Badge variant="destructive">{r.daysLate} day(s)</Badge> : "—"}</TableCell>
                    <TableCell>{r.hasPlan ? <Badge variant="success">Plan active</Badge> : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {r.invoices.map((i) => (
                        <p key={i.id} className="font-mono">{i.invoiceNumber} · {i.status} · {formatCurrency(i.amount - i.paidAmount)}</p>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment plans ({plans.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Installment</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No payment plans.</TableCell></TableRow>
              )}
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{p.student.firstName} {p.student.lastName}</TableCell>
                  <TableCell className="text-xs font-mono">{p.invoice?.invoiceNumber ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.totalAmount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.installmentAmount)}</TableCell>
                  <TableCell className="text-right">{p.installmentCount}</TableCell>
                  <TableCell className="text-xs">{p.frequency}</TableCell>
                  <TableCell><Badge variant={p.status === "ACTIVE" ? "success" : "secondary"}>{p.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {p.status === "ACTIVE" && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" className="text-green-600" onClick={() => planAction(p.id, "COMPLETED")}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => planAction(p.id, "CANCELLED")}><XCircle className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New payment plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Student</Label>
              <Select value={planForm.studentId} onValueChange={(v) => setPlanForm({ ...planForm, studentId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total (₦)</Label>
                <Input type="number" min={0} value={planForm.totalAmount} onChange={(e) => setPlanForm({ ...planForm, totalAmount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Installment (₦)</Label>
                <Input type="number" min={0} value={planForm.installmentAmount} onChange={(e) => setPlanForm({ ...planForm, installmentAmount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Installments</Label>
                <Input type="number" min={1} max={52} value={planForm.installmentCount} onChange={(e) => setPlanForm({ ...planForm, installmentCount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={planForm.frequency} onValueChange={(v) => setPlanForm({ ...planForm, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="TERMLY">Termly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>First due date (optional)</Label>
              <Input type="date" value={planForm.dueDate} onChange={(e) => setPlanForm({ ...planForm, dueDate: e.target.value })} />
            </div>
            <Button className="w-full" onClick={savePlan} disabled={savingPlan}>
              {savingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-1" />}
              {savingPlan ? "Saving…" : "Create plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
