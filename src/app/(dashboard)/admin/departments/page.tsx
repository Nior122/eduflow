"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, FolderTree, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Department = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  headTeacher: { id: string; firstName: string; lastName: string } | null;
  teachers: { id: string }[];
  subjects: { id: string }[];
};

const EMPTY_FORM = { name: "", code: "", description: "", headTeacherId: "" };

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const load = () =>
    fetch("/api/admin/departments")
      .then((r) => r.ok && r.json())
      .then((d) => d?.departments && setDepartments(d.departments))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    fetch("/api/admin/teachers")
      .then((r) => r.ok && r.json())
      .then((d) => d?.teachers && setTeachers(d.teachers))
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setFormData({
      name: d.name,
      code: d.code ?? "",
      description: d.description ?? "",
      headTeacherId: d.headTeacher?.id ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return toast({ title: "Department name required", variant: "destructive" });
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        code: formData.code || undefined,
        description: formData.description || undefined,
        headTeacherId: formData.headTeacherId || null,
      };
      const res = editing
        ? await fetch(`/api/admin/departments/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/departments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: editing ? "Department updated" : "Department created", variant: "success" });
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save department", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: Department) => {
    try {
      const res = await fetch(`/api/admin/departments/${d.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Department deleted", variant: "success" });
      load();
    } catch {
      toast({ title: "Failed to delete department", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Departments</h2>
          <p className="text-muted-foreground">Organize teachers and subjects by department</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Department" : "Create Department"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Sciences" /></div>
              <div className="space-y-2"><Label>Code (optional)</Label><Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. SCI" /></div>
              <div className="space-y-2"><Label>Head of Department</Label>
                <Select value={formData.headTeacherId} onValueChange={(v) => setFormData({ ...formData, headTeacherId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Description</Label><Textarea rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editing ? "Save Changes" : "Create Department"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />) :
          departments.length === 0 ? (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="py-12 text-center">
                <FolderTree className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No departments yet — create your first department</p>
              </CardContent>
            </Card>
          ) : departments.map((d) => (
            <Card key={d.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderTree className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{d.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    {d.code && <Badge variant="outline" className="font-mono text-xs">{d.code}</Badge>}
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${d.name}`} onClick={() => openEdit(d)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDialog
                      title="Delete department?"
                      description={`"${d.name}" will be deactivated. Members keep their records.`}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${d.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                      onConfirm={() => handleDelete(d)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground line-clamp-2">{d.description || "No description"}</p>
                <div className="flex items-center justify-between text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Head: {d.headTeacher ? `${d.headTeacher.firstName} ${d.headTeacher.lastName}` : "—"}</p>
                    <p className="text-muted-foreground">{d.teachers.length} teachers · {d.subjects.length} subjects</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
