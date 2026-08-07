"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, GraduationCap, Pencil, Trash2, Loader2, Mail, Phone, BookMarked, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getInitials, formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CredentialsDialog } from "@/components/credentials-dialog";

type TeacherSubject = {
  class: { id: string; name: string };
  subject: { id: string; name: string };
};

type Teacher = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  employeeDate: string;
  qualification: string | null;
  specialization: string | null;
  classSubjects: TeacherSubject[];
  _count: { attendances: number; results: number; lessonPlans: number };
};

const EMPTY_FORM = {
  firstName: "", lastName: "", email: "", phone: "",
  qualification: "", specialization: "", employeeDate: "",
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [assignFor, setAssignFor] = useState<Teacher | null>(null);
  const [assignClass, setAssignClass] = useState("");
  const [assignSubject, setAssignSubject] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [creds, setCreds] = useState<{ email: string; tempPassword: string } | null>(null);

  const load = () =>
    fetch("/api/admin/teachers")
      .then((r) => r.ok && r.json())
      .then((d) => d?.teachers && setTeachers(d.teachers))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    fetch("/api/admin/classes").then(r => r.ok && r.json()).then(d => d?.classes && setClasses(d.classes)).catch(() => {});
    fetch("/api/admin/subjects").then(r => r.ok && r.json()).then(d => d?.subjects && setSubjects(d.subjects)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (t: Teacher) => {
    setEditing(t);
    setFormData({
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      phone: t.phone ?? "",
      qualification: t.qualification ?? "",
      specialization: t.specialization ?? "",
      employeeDate: t.employeeDate ? new Date(t.employeeDate).toISOString().slice(0, 10) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      return toast({ title: "Name and email are required", variant: "destructive" });
    }
    setSaving(true);
    try {
      const res = editing
        ? await fetch(`/api/admin/teachers/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          })
        : await fetch("/api/admin/teachers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: editing ? "Teacher updated" : "Teacher added", variant: "success" });
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
      if (!editing && data.credentials) {
        setCreds({ email: data.credentials.email, tempPassword: data.credentials.tempPassword });
      }
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save teacher", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: Teacher) => {
    try {
      const res = await fetch(`/api/admin/teachers/${t.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Teacher deleted", variant: "success" });
      load();
    } catch {
      toast({ title: "Failed to delete teacher", variant: "destructive" });
    }
  };

  const openAssign = (t: Teacher) => {
    setAssignFor(t);
    setAssignClass("");
    setAssignSubject("");
  };

  const handleAssign = async () => {
    if (!assignFor || !assignClass || !assignSubject) {
      return toast({ title: "Select a class and a subject", variant: "destructive" });
    }
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/class-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: assignClass, subjectId: assignSubject, teacherId: assignFor.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Subject assigned", variant: "success" });
      setAssignFor(null);
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to assign subject", variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (t: Teacher, cs: TeacherSubject) => {
    try {
      const res = await fetch(`/api/admin/class-subjects?classId=${cs.class.id}&subjectId=${cs.subject.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Assignment removed", variant: "success" });
      load();
    } catch {
      toast({ title: "Failed to remove assignment", variant: "destructive" });
    }
  };

  const availableAssignments = (t: Teacher) => {
    const taken = new Set(t.classSubjects.map((cs) => `${cs.class.id}:${cs.subject.id}`));
    return classes
      .flatMap((c) => subjects.map((s) => ({ c, s })))
      .filter(({ c, s }) => !taken.has(`${c.id}:${s.id}`));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teachers</h2>
          <p className="text-muted-foreground">Manage teaching staff and their assignments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Teacher
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Teacher" : "Add New Teacher"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>First Name *</Label><Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} /></div>
                <div className="space-y-2"><Label>Last Name *</Label><Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Email (used for login) *</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>Employment Date</Label><Input type="date" value={formData.employeeDate} onChange={(e) => setFormData({ ...formData, employeeDate: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Qualification</Label><Input value={formData.qualification} onChange={(e) => setFormData({ ...formData, qualification: e.target.value })} placeholder="e.g. B.Ed, M.Sc" /></div>
              <div className="space-y-2"><Label>Specialization</Label><Input value={formData.specialization} onChange={(e) => setFormData({ ...formData, specialization: e.target.value })} placeholder="e.g. Mathematics" /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editing ? "Save Changes" : "Save Teacher"}
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
                <TableHead>Teacher</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden md:table-cell">Assignments</TableHead>
                <TableHead className="hidden lg:table-cell">Qualification</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : teachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <GraduationCap className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No teachers added yet</p>
                      <Button variant="outline" size="sm" onClick={openCreate}>Add your first teacher</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                teachers.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(`${t.firstName} ${t.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{t.firstName} {t.lastName}</p>
                          <p className="text-xs text-muted-foreground">{t.specialization || "General"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {t.email}</span>
                        {t.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {t.phone}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap items-center gap-1">
                        {t.classSubjects.length > 0 ? (
                          t.classSubjects.slice(0, 3).map((cs) => (
                            <Badge key={`${cs.class.id}-${cs.subject.id}`} variant="secondary" className="text-xs">
                              {cs.subject.name} ({cs.class.name})
                              <button
                                className="ml-1 inline-flex hover:text-destructive"
                                aria-label={`Remove ${cs.subject.name} from ${cs.class.name}`}
                                onClick={() => handleUnassign(t, cs)}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">Not assigned</span>
                        )}
                        {t.classSubjects.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{t.classSubjects.length - 3} more</Badge>
                        )}
                        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => openAssign(t)}>
                          <BookMarked className="mr-1 h-3 w-3" /> Assign
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{t.qualification || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(t.employeeDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${t.firstName} ${t.lastName}`} onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <ConfirmDialog
                          title="Delete teacher?"
                          description={`${t.firstName} ${t.lastName} will be deactivated and their login disabled.`}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${t.firstName} ${t.lastName}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                          onConfirm={() => handleDelete(t)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assign subject dialog */}
      <Dialog open={!!assignFor} onOpenChange={(open) => !open && setAssignFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign subject — {assignFor ? `${assignFor.firstName} ${assignFor.lastName}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={assignClass} onValueChange={setAssignClass}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={assignSubject} onValueChange={setAssignSubject}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {assignFor
                    ? availableAssignments(assignFor).map(({ c, s }) => (
                        <SelectItem key={`${c.id}:${s.id}`} value={s.id}>
                          {s.name} ({c.name})
                        </SelectItem>
                      ))
                    : subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setAssignFor(null)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={assigning}>
              {assigning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Assigning...</> : "Assign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* One-time credentials */}
      <CredentialsDialog
        open={!!creds}
        onOpenChange={(open) => !open && setCreds(null)}
        email={creds?.email ?? ""}
        tempPassword={creds?.tempPassword ?? ""}
      />
    </div>
  );
}
