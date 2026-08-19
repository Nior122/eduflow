"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, BookOpen, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

type ClassItem = {
  id: string;
  name: string;
  category: string;
  section: string | null;
  capacity: number | null;
  _count: { students: number };
};

const EMPTY_FORM = { name: "", category: "PRIMARY", section: "", capacity: "" };

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const load = () =>
    fetch("/api/admin/classes")
      .then((r) => r.ok && r.json())
      .then((d) => d?.classes && setClasses(d.classes))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (cls: ClassItem) => {
    setEditing(cls);
    setFormData({
      name: cls.name,
      category: cls.category,
      section: cls.section ?? "",
      capacity: cls.capacity != null ? String(cls.capacity) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return toast({ title: "Class name required", variant: "destructive" });
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        section: formData.section || undefined,
        capacity: formData.capacity ? Number(formData.capacity) : undefined,
      };
      const res = editing
        ? await fetch(`/api/admin/classes/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/classes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: editing ? "Class updated" : "Class created", variant: "success" });
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to save class",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cls: ClassItem) => {
    try {
      const res = await fetch(`/api/admin/classes/${cls.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Class deleted", variant: "success" });
      load();
    } catch {
      toast({ title: "Failed to delete class", variant: "destructive" });
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "PRIMARY": return <Badge variant="info">Primary</Badge>;
      case "JUNIOR_SECONDARY": return <Badge variant="warning">JSS</Badge>;
      case "SENIOR_SECONDARY": return <Badge variant="success">SS</Badge>;
      default: return <Badge>{cat}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Classes</h2>
          <p className="text-muted-foreground">Manage class structure and sections</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Class" : "Create New Class"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Class Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Primary 1"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIMARY">Primary</SelectItem>
                    <SelectItem value="JUNIOR_SECONDARY">Junior Secondary (JSS)</SelectItem>
                    <SelectItem value="SENIOR_SECONDARY">Senior Secondary (SS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section (optional)</Label>
                <Input
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  placeholder="e.g. A, B, or Science"
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity (optional)</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="e.g. 40"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editing ? "Save Changes" : "Create Class"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          : classes.map((cls) => (
              <Card key={cls.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{cls.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      {getCategoryBadge(cls.category)}
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${cls.name}`} onClick={() => openEdit(cls)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        title="Delete class?"
                        description={`"${cls.name}" will be deactivated. Existing students keep their records.`}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${cls.name}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        onConfirm={() => handleDelete(cls)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">
                        {cls.section ? `Section: ${cls.section}` : "No section"}
                      </p>
                      <p className="text-muted-foreground">
                        {cls.capacity ? `Capacity: ${cls.capacity}` : "Unlimited capacity"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{cls._count.students}</p>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}
