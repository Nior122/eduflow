"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, DoorOpen, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Classroom = {
  id: string;
  name: string;
  roomNumber: string | null;
  location: string | null;
  capacity: number | null;
  classId: string | null;
  studentCount: number;
  class: { id: string; name: string } | null;
  classTeacher: { id: string; firstName: string; lastName: string } | null;
  assistantTeacher: { id: string; firstName: string; lastName: string } | null;
};

const EMPTY_FORM = {
  name: "", roomNumber: "", location: "", capacity: "", classId: "", classTeacherId: "", assistantTeacherId: "",
};

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const load = () =>
    fetch("/api/admin/classrooms")
      .then((r) => r.ok && r.json())
      .then((d) => d?.classrooms && setClassrooms(d.classrooms))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    fetch("/api/admin/classes").then((r) => r.ok && r.json()).then((d) => d?.classes && setClasses(d.classes)).catch(() => {});
    fetch("/api/admin/teachers").then((r) => r.ok && r.json()).then((d) => d?.teachers && setTeachers(d.teachers)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (c: Classroom) => {
    setEditing(c);
    setFormData({
      name: c.name,
      roomNumber: c.roomNumber ?? "",
      location: c.location ?? "",
      capacity: c.capacity != null ? String(c.capacity) : "",
      classId: c.classId ?? "",
      classTeacherId: c.classTeacher?.id ?? "",
      assistantTeacherId: c.assistantTeacher?.id ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return toast({ title: "Classroom name required", variant: "destructive" });
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        roomNumber: formData.roomNumber || undefined,
        location: formData.location || undefined,
        capacity: formData.capacity ? Number(formData.capacity) : undefined,
        classId: formData.classId || null,
        classTeacherId: formData.classTeacherId || null,
        assistantTeacherId: formData.assistantTeacherId || null,
      };
      const res = editing
        ? await fetch(`/api/admin/classrooms/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/classrooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: editing ? "Classroom updated" : "Classroom created", variant: "success" });
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save classroom", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Classroom) => {
    try {
      const res = await fetch(`/api/admin/classrooms/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Classroom deleted", variant: "success" });
      load();
    } catch {
      toast({ title: "Failed to delete classroom", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Classrooms</h2>
          <p className="text-muted-foreground">Manage rooms, capacity, and class teachers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Classroom
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Classroom" : "Add Classroom"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Room 12" /></div>
                <div className="space-y-2"><Label>Room Number</Label><Input value={formData.roomNumber} onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Location</Label><Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g. Block A" /></div>
                <div className="space-y-2"><Label>Capacity</Label><Input type="number" min={1} value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Linked Class</Label>
                <Select value={formData.classId} onValueChange={(v) => setFormData({ ...formData, classId: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class Teacher</Label>
                <Select value={formData.classTeacherId} onValueChange={(v) => setFormData({ ...formData, classTeacherId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assistant Teacher</Label>
                <Select value={formData.assistantTeacherId} onValueChange={(v) => setFormData({ ...formData, assistantTeacherId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editing ? "Save Changes" : "Create Classroom"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classroom</TableHead>
                <TableHead className="hidden md:table-cell">Room / Location</TableHead>
                <TableHead className="hidden md:table-cell">Linked Class</TableHead>
                <TableHead className="hidden lg:table-cell">Class Teacher</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                </TableRow>
              )) : classrooms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <DoorOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No classrooms yet</p>
                  </TableCell>
                </TableRow>
              ) : classrooms.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <DoorOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.studentCount} students</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {c.roomNumber || "—"} {c.location ? `· ${c.location}` : ""}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{c.class ? <Badge variant="secondary">{c.class.name}</Badge> : "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {c.classTeacher ? `${c.classTeacher.firstName} ${c.classTeacher.lastName}` : "—"}
                    {c.assistantTeacher ? <span className="block text-xs text-muted-foreground">Asst: {c.assistantTeacher.firstName} {c.assistantTeacher.lastName}</span> : null}
                  </TableCell>
                  <TableCell className="text-sm">{c.capacity ? `${c.capacity}` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${c.name}`} onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        title="Delete classroom?"
                        description={`"${c.name}" will be deactivated.`}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${c.name}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        onConfirm={() => handleDelete(c)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
