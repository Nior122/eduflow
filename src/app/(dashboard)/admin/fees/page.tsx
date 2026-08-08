"use client";

import { useState, useEffect, useCallback } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Plus, Pencil, Trash2, Loader2, Tag, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

type FeeCategory = { id: string; name: string; code: string | null; color: string | null; _count: { fees: number } };
type ClassRow = { id: string; name: string };
type Department = { id: string; name: string };
type FeeRecord = { amount: string; status: string };

type Fee = {
  id: string;
  name: string;
  description: string | null;
  amount: string;
  term: string | null;
  session: string | null;
  isOptional: boolean;
  isRecurring: boolean;
  lateFee: string | null;
  feeCategory: { id: string; name: string; color: string | null } | null;
  class: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  _count: { feeRecords: number };
  feeRecords: FeeRecord[];
};

type StudentOption = { id: string; firstName: string; lastName: string; admissionNumber: string };

const EMPTY_FORM = {
  name: "", description: "", amount: "", term: "FIRST", isOptional: "false",
  isRecurring: "false", lateFee: "", feeCategoryId: "", classId: "", departmentId: "",
};
const EMPTY_CATEGORY = { name: "", code: "", description: "", color: "" };

export default function FeesPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Fee | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FeeCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY);
  const [savingCategory, setSavingCategory] = useState(false);

  const [payFor, setPayFor] = useState<Fee | null>(null);
  const [payForm, setPayForm] = useState({ studentId: "", amount: "", method: "CASH" });
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      fetch("/api/admin/fees").then((r) => r.ok && r.json()),
      fetch("/api/finance/categories").then((r) => r.ok && r.json()),
      fetch("/api/admin/classes").then((r) => r.ok && r.json()),
      fetch("/api/admin/departments").then((r) => r.ok && r.json()),
    ])
      .then(([f, c, cl, d]) => {
        if (f?.fees) setFees(f.fees);
        if (c?.categories) setCategories(c.categories);
        if (cl?.classes) setClasses(cl.classes);
        if (d?.departments) setDepartments(d.departments);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/students?limit=100")
      .then((r) => r.ok && r.json())
      .then((d) => d?.students && setStudents(d.students))
      .catch(() => {});
  }, [load]);

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
      isRecurring: fee.isRecurring ? "true" : "false",
      lateFee: fee.lateFee ?? "",
      feeCategoryId: fee.feeCategory?.id ?? "",
      classId: fee.class?.id ?? "",
      departmentId: fee.department?.id ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.amount) return toast({ title: "Name and amount required", variant: "destructive" });
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        amount: parseFloat(formData.amount),
        term: formData.term,
        isOptional: formData.isOptional === "true",
        isRecurring: formData.isRecurring === "true",
        lateFee: formData.lateFee ? parseFloat(formData.lateFee) : null,
        feeCategoryId: formData.feeCategoryId || undefined,
        classId: formData.classId || null,
        departmentId: formData.departmentId || null,
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Fee deleted", variant: "success" });
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to delete fee", variant: "destructive" });
    }
  };

  const saveCategory = async () => {
    if (!categoryForm.name) return toast({ title: "Name required", variant: "destructive" });
    setSavingCategory(true);
    try {
      const res = editingCategory
        ? await fetch("/api/finance/categories", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingCategory.id, ...categoryForm }),
          })
        : await fetch("/api/finance/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(categoryForm),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: editingCategory ? "Category updated" : "Category created", variant: "success" });
      setCategoryDialog(false);
      setCategoryForm(EMPTY_CATEGORY);
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setSavingCategory(false);
    }
  };

  const deleteCategory = async (cat: FeeCategory) => {
    try {
      const res = await fetch(`/api/finance/categories?id=${cat.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Category deleted", variant: "success" });
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed", variant: "destructive" });
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

  const allRecords = fees.flatMap((f) => f.feeRecords);
  const paidSum = allRecords.filter((r) => r.status === "PAID" || r.status === "WAIVED").reduce((s, r) => s + Number(r.amount), 0);
  const expectedSum = allRecords.reduce((s, r) => s + Number(r.amount), 0);
  const collectionRate = expectedSum > 0 ? Math.round((paidSum / expectedSum) * 100) : 0;
  const totalFeeValue = fees.reduce((s, f) => s + Number(f.amount), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Fee Structure</h2>
          <p className="text-sm text-muted-foreground">Fee categories, billing structure and legacy per-fee payment records.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Fee</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Fees defined" value={fees.length} icon={DollarSign} />
        <StatCard title="Categories" value={categories.length} icon={Tag} />
        <StatCard title="Total fee value" value={formatCurrency(totalFeeValue)} icon={DollarSign} />
        <StatCard title="Collection rate" value={`${collectionRate}%`} icon={TrendingUp} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="fees">
            <TabsList>
              <TabsTrigger value="fees">Fees ({fees.length})</TabsTrigger>
              <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="fees" className="space-y-3">
              {loading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fee</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fees.map((fee) => (
                      <TableRow key={fee.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{fee.name}</p>
                          <p className="text-xs text-muted-foreground">{fee.description ?? "—"}</p>
                        </TableCell>
                        <TableCell>
                          {fee.feeCategory ? (
                            <Badge variant="secondary" className={fee.feeCategory.color ?? ""}>{fee.feeCategory.name}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {fee.class ? `Class: ${fee.class.name}` : fee.department ? `Dept: ${fee.department.name}` : "Whole school"}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(fee.amount))}</TableCell>
                        <TableCell className="text-xs">{fee.term ?? "—"}{fee.session ? ` · ${fee.session}` : ""}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {fee.isOptional && <Badge variant="secondary" className="text-[10px]">Optional</Badge>}
                            {fee.isRecurring && <Badge variant="secondary" className="text-[10px]">Recurring</Badge>}
                            {fee.lateFee && <Badge variant="secondary" className="text-[10px]">Late fee: {formatCurrency(Number(fee.lateFee))}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => setPayFor(fee)}>Record payment</Button>
                            <Button size="sm" variant="outline" onClick={() => openEdit(fee)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <ConfirmDialog
                              trigger={
                                <Button size="sm" variant="outline" className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                              }
                              title="Delete fee?"
                              description={`"${fee.name}" will be deactivated. Fees with payment records cannot be deleted.`}
                              confirmLabel="Delete"
                              onConfirm={() => handleDelete(fee)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {fees.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No fees defined yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="categories" className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => { setEditingCategory(null); setCategoryForm(EMPTY_CATEGORY); setCategoryDialog(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Add category
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell>
                        <span className={`inline-flex items-center gap-2 font-medium text-sm ${cat.color ?? ""}`}>
                          <span className="h-2.5 w-2.5 rounded-full bg-current inline-block" /> {cat.name}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{cat.code ?? "—"}</TableCell>
                      <TableCell className="text-right">{cat._count.fees}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => { setEditingCategory(cat); setCategoryForm({ name: cat.name, code: cat.code ?? "", description: "", color: cat.color ?? "" }); setCategoryDialog(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <ConfirmDialog
                            trigger={<Button size="sm" variant="outline" className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>}
                            title="Delete category?"
                            description={`"${cat.name}" cannot be deleted while fees reference it.`}
                            confirmLabel="Delete"
                            onConfirm={() => deleteCategory(cat)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {categories.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No categories yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Fee create/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Fee" : "Create Fee"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Tuition Fee" />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₦)</Label>
                <Input type="number" min={0} value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={formData.feeCategoryId} onValueChange={(v) => setFormData({ ...formData, feeCategoryId: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Class scope (optional)</Label>
                <Select value={formData.classId} onValueChange={(v) => setFormData({ ...formData, classId: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Whole school" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Whole school</SelectItem>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Department (optional)</Label>
                <Select value={formData.departmentId} onValueChange={(v) => setFormData({ ...formData, departmentId: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Term</Label>
                <Select value={formData.term} onValueChange={(v) => setFormData({ ...formData, term: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIRST">First Term</SelectItem>
                    <SelectItem value="SECOND">Second Term</SelectItem>
                    <SelectItem value="THIRD">Third Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Late fee (₦, optional)</Label>
                <Input type="number" min={0} value={formData.lateFee} onChange={(e) => setFormData({ ...formData, lateFee: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={formData.isOptional === "true"} onChange={(e) => setFormData({ ...formData, isOptional: e.target.checked ? "true" : "false" })} />
                Optional fee
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={formData.isRecurring === "true"} onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked ? "true" : "false" })} />
                Recurring (every term)
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4 mr-1" />}
              {saving ? "Saving…" : "Save Fee"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="e.g. Tuition" />
              </div>
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} placeholder="TUITION" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color class (tailwind, optional)</Label>
              <Input value={categoryForm.color} onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })} placeholder="text-blue-600" />
            </div>
            <Button className="w-full" onClick={saveCategory} disabled={savingCategory}>
              {savingCategory && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {savingCategory ? "Saving…" : "Save Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Legacy per-fee payment dialog */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record payment — {payFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Student</Label>
              <Select value={payForm.studentId} onValueChange={(v) => setPayForm({ ...payForm, studentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (₦)</Label>
                <Input type="number" min={0} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CARD">Card (POS)</SelectItem>
                    <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
              <Button onClick={handlePayment} disabled={paying}>
                {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {paying ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
