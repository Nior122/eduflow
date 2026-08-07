"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BookMarked, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Subject = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
};

const EMPTY_FORM = { name: "", code: "", category: "PRIMARY" };

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const load = () =>
    fetch("/api/admin/subjects")
      .then((r) => r.ok && r.json())
      .then((d) => d?.subjects && setSubjects(d.subjects))
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

  const openEdit = (subject: Subject) => {
    setEditing(subject);
    setFormData({
      name: subject.name,
      code: subject.code ?? "",
      category: subject.category ?? "PRIMARY",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return toast({ title: "Subject name required", variant: "destructive" });
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        code: formData.code || undefined,
        category: formData.category || undefined,
      };
      const res = editing
        ? await fetch(`/api/admin/subjects/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/subjects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: editing ? "Subject updated" : "Subject created", variant: "success" });
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to save subject",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (subject: Subject) => {
    try {
      const res = await fetch(`/api/admin/subjects/${subject.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Subject deleted", variant: "success" });
      load();
    } catch {
      toast({ title: "Failed to delete subject", variant: "destructive" });
    }
  };

  const categoryBadge = (cat: string | null) => {
    switch (cat) {
      case "PRIMARY": return <Badge variant="info">Primary</Badge>;
      case "JUNIOR_SECONDARY": return <Badge variant="warning">JSS</Badge>;
      case "SENIOR_SECONDARY": return <Badge variant="success">SS</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Subjects</h2>
          <p className="text-muted-foreground">Manage the subjects offered at your school</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Subject" : "Create New Subject"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Subject Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Mathematics"
                />
              </div>
              <div className="space-y-2">
                <Label>Code (optional)</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g. MAT"
                />
              </div>
              <div className="space-y-2">
                <Label>Category (optional)</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIMARY">Primary</SelectItem>
                    <SelectItem value="JUNIOR_SECONDARY">Junior Secondary (JSS)</SelectItem>
                    <SelectItem value="SENIOR_SECONDARY">Senior Secondary (SS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editing ? "Save Changes" : "Create Subject"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookMarked className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No subjects yet — add your first subject</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <Card key={subject.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <BookMarked className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{subject.name}</p>
                    <p className="text-xs text-muted-foreground">{subject.code ? `Code: ${subject.code}` : "No code"}</p>
                  </div>
                  {categoryBadge(subject.category)}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${subject.name}`} onClick={() => openEdit(subject)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDialog
                    title="Delete subject?"
                    description={`"${subject.name}" will be deactivated. Existing results keep their data.`}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${subject.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                    onConfirm={() => handleDelete(subject)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
