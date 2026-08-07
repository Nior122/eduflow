"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, Plus, Pencil, Trash2, Loader2, Wallet, ReceiptText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

type FeeRecord = { amount: string; status: string };
type Fee = {
  id: string;
  name: string;
  description: string | null;
  amount: string;
  term: string | null;
  isOptional: boolean;
  _count: { feeRecords: number };
  feeRecords: FeeRecord[];
};

type StudentOption = { id: string; firstName: string; lastName: string; admissionNumber: string };

const EMPTY_FORM = { name: "", description: "", amount: "", term: "FIRST", isOptional: "false" };

export default function FeesPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Fee | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [payFor, setPayFor] = useState<Fee | null>(null);
  const [payForm, setPayForm] = useState({ studentId: "", amount: "", method: "CASH" });
  const [paying, setPaying] = useState(false);

  const load = () =>
    fetch("/api/admin/fees")
      .then((r) => r.ok && r.json())
      .then((d) => d?.fees && setFees(d.fees))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    fetch("/api/admin/students?limit=100")
      .then((r) => r.ok && r.json())
      .then((d) => d?.students && setStudents(d.students))
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (fee: Fee) => {
    setEditing(fee);
    setFormData({
      name: fee.name,
      description: fee.description ?? "",
      amount: fee.amount,
      term: fee.term ?? "FIRST",
      isOptional: fee.isOptional ? "true" : "false",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.amount) return toast({ title: "Name and amount required", variant: "destructive" });
    setSaving(true);
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        isOptional: formData.isOptional === "true",
      };
      const res = editing
        ? await fetch(`/api/admin/fees/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/fees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: editing ? "Fee updated" : "Fee created", variant: "success" });
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save fee", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fee: Fee) => {
    try {
      const res = await fetch(`/api/admin/fees/${fee.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Fee deleted", variant: "success" });
      load();
    } catch {
      toast({ title: "Failed to delete fee", variant: "destructive" });
    }
  };

  const handlePayment = async () => {
    if (!payFor || !payForm.studentId || !payForm.amount) {
      return toast({ title: "Select a student and enter an amount", variant: "destructive" });
    }
    setPaying(true);
    try {
      const res = await fetch(`/api/admin/fees/${payFor.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: payForm.studentId,
          amount: parseFloat(payForm.amount),
          method: payForm.method,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Payment recorded", variant: "success" });
      setPayFor(null);
      setPayForm({ studentId: "", amount: "", method: "CASH" });
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to record payment", variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  // Real money stats from recorded fee records
  const allRecords = fees.flatMap((f) => f.feeRecords);
  const paidSum = allRecords
    .filter((r) => r.status === "PAID" || r.status === "WAIVED")
    .reduce((s, r) => s + Number(r.amount), 0);
  const expectedSum = allRecords.reduce((s, r) => s + Number(r.amount), 0);
  const collectionRate = expectedSum > 0 ? Math.round((paidSum / expectedSum) * 100) : 0;
  const totalFeeValue = fees.reduce((s, f) => s + Number(f.amount), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fee Management</h2>
          <p className="text-muted-foreground">Manage tuition, books, and other fees</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Fee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Fee Type" : "Create Fee Type"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>Fee Name</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Tuition" /></div>
              <div className="space-y-2"><Label>Amount (₦)</Label><Input type="number" min={1} value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} /></div>
              <div className="space-y-2"><Label>Term</Label><Select value={formData.term} onValueChange={(v) => setFormData({ ...formData, term: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIRST">First Term</SelectItem><SelectItem value="SECOND">Second Term</SelectItem><SelectItem value="THIRD">Third Term</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Optional?</Label><Select value={formData.isOptional} onValueChange={(v) => setFormData({ ...formData, isOptional: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="false">Required</SelectItem><SelectItem value="true">Optional</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Description</Label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editing ? "Save Changes" : "Create Fee"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Fee Types" value={fees.length} icon={Wallet} />
        <StatCard title="Total Fee Value" value={formatCurrency(totalFeeValue)} icon={DollarSign} />
        <StatCard title="Collection Rate" value={allRecords.length > 0 ? `${collectionRate}%` : "—"} icon={ReceiptText} />
        <StatCard title="Collected" value={formatCurrency(paidSum)} icon={DollarSign} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden md:table-cell">Term</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              )) : fees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <p className="text-muted-foreground">No fee types yet — add your first fee</p>
                  </TableCell>
                </TableRow>
              ) : fees.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell>{formatCurrency(f.amount)}</TableCell>
                  <TableCell className="hidden md:table-cell">{f.term ? f.term.charAt(0) + f.term.slice(1).toLowerCase() + " Term" : "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{f.isOptional ? <Badge variant="outline">Optional</Badge> : <Badge>Required</Badge>}</TableCell>
                  <TableCell className="text-right">{f._count.feeRecords}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPayFor(f)}>
                        <ReceiptText className="mr-1 h-3 w-3" /> Record Payment
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${f.name}`} onClick={() => openEdit(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        title="Delete fee?"
                        description={`"${f.name}" will be deactivated. Existing payment records are kept.`}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${f.name}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        onConfirm={() => handleDelete(f)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Record payment dialog */}
      <Dialog open={!!payFor} onOpenChange={(open) => !open && setPayFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment — {payFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={payForm.studentId} onValueChange={(v) => setPayForm({ ...payForm, studentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.admissionNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input type="number" min={1} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder={payFor ? `Outstanding: ${formatCurrency(Math.max(0, Number(payFor.amount)))}` : ""} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
            <Button onClick={handlePayment} disabled={paying}>
              {paying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</> : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
