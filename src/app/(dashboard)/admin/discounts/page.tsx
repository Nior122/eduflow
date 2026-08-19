"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Loader2, Plus, CheckCheck, XCircle, Percent } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { DISCOUNT_TYPE_LABEL, DISCOUNT_SCOPE_LABEL } from "@/lib/finance/types";

type StudentRow = { id: string; firstName: string; lastName: string; admissionNumber: string };
type ClassRow = { id: string; name: string };
type FeeRow = { id: string; name: string };

type DiscountRow = {
  id: string;
  name: string;
  code: string | null;
  type: string;
  value: string;
  scope: string;
  reason: string | null;
  status: string;
  validUntil: string | null;
  student: { firstName: string; lastName: string; admissionNumber: string } | null;
  class: { name: string } | null;
  createdBy: { name: string | null } | null;
  approvedBy: { name: string | null } | null;
  _count: { invoices: number };
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  EXPIRED: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
};

const EMPTY_FORM = { name: "", code: "", type: "PERCENTAGE", value: "", scope: "STUDENT", studentId: "", classId: "", feeId: "", reason: "", validUntil: "" };

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, sRes, cRes, fRes] = await Promise.all([
        fetch(`/api/finance/discounts${statusFilter ? `?status=${statusFilter}` : ""}`).then((r) => parseJsonBody(r)),
        fetch("/api/admin/students?limit=200").then((r) => parseJsonBody(r)),
        fetch("/api/admin/classes").then((r) => parseJsonBody(r)),
        fetch("/api/admin/fees").then((r) => parseJsonBody(r)),
      ]);
      setDiscounts(dRes.discounts ?? []);
      setStudents(sRes.students ?? []);
      setClasses(cRes.classes ?? []);
      setFees(fRes.fees ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name || !form.value) return toast({ title: "Name and value required", variant: "destructive" });
    setSaving(true);
    try {
      const res = await fetch("/api/finance/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          code: form.code || undefined,
          type: form.type,
          value: parseFloat(form.value),
          scope: form.scope,
          studentId: form.scope === "STUDENT" ? form.studentId || undefined : undefined,
          classId: form.scope === "CLASS" ? form.classId || undefined : undefined,
          feeId: form.scope === "FEE" ? form.feeId || undefined : undefined,
          reason: form.reason || undefined,
          validUntil: form.validUntil || null,
        }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Discount created - pending approval" });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const review = async (id: string, action: "APPROVE" | "REJECT") => {
    try {
      const res = await fetch(`/api/finance/discounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Discount " + action.toLowerCase() + "d" });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  const formatValue = (d: DiscountRow) => {
    if (d.type === "WAIVER") return "100%";
    if (["PERCENTAGE", "SCHOLARSHIP", "SIBLING", "STAFF"].includes(d.type)) return d.value + "%";
    return formatCurrency(Number(d.value));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Percent className="h-5 w-5" /> Discounts &amp; Scholarships</h2>
          <p className="text-sm text-muted-foreground">Scholarships, sibling/staff discounts, waivers - with an approval workflow. Approved discounts apply automatically at billing.</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New discount</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Discount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Applied</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No discounts yet.</TableCell></TableRow>
                )}
                {discounts.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.scope === "STUDENT" && d.student ? d.student.firstName + " " + d.student.lastName : d.scope === "CLASS" ? (d.class?.name ?? "") : d.scope === "FEE" ? "Specific fee" : "Whole school"}
                        {d.code ? " - " + d.code : ""}
                      </p>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{DISCOUNT_TYPE_LABEL[d.type as keyof typeof DISCOUNT_TYPE_LABEL] ?? d.type}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{formatValue(d)}</TableCell>
                    <TableCell className="text-xs">{DISCOUNT_SCOPE_LABEL[d.scope] ?? d.scope}</TableCell>
                    <TableCell className="text-right">{d._count.invoices}</TableCell>
                    <TableCell><Badge className={STATUS_BADGE[d.status] ?? ""}>{d.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {d.status === "PENDING" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="text-green-600" onClick={() => review(d.id, "APPROVE")}>
                            <CheckCheck className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => review(d.id, "REJECT")}>
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{d.approvedBy?.name ?? "-"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New discount / scholarship</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Academic Scholarship" />
              </div>
              <div className="space-y-1.5">
                <Label>Code (optional)</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SCH-001" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DISCOUNT_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{["PERCENTAGE", "SCHOLARSHIP", "SIBLING", "STAFF"].includes(form.type) ? "Value (%)" : "Value (N)"}</Label>
                <Input type="number" min={0} max={["PERCENTAGE", "SCHOLARSHIP", "SIBLING", "STAFF"].includes(form.type) ? 100 : undefined} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Student</SelectItem>
                  <SelectItem value="CLASS">Class</SelectItem>
                  <SelectItem value="SCHOOL">Whole school</SelectItem>
                  <SelectItem value="FEE">Specific fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.scope === "STUDENT" && (
              <div className="space-y-1.5">
                <Label>Student</Label>
                <Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.scope === "CLASS" && (
              <div className="space-y-1.5">
                <Label>Class</Label>
                <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.scope === "FEE" && (
              <div className="space-y-1.5">
                <Label>Fee</Label>
                <Select value={form.feeId} onValueChange={(v) => setForm({ ...form, feeId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {fees.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Valid until (optional)</Label>
              <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. 50% bursary for high achievement" />
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              {saving ? "Saving..." : "Create (pending approval)"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
