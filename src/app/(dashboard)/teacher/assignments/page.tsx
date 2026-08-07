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
import { Plus, ClipboardList, Pencil, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  maxScore: number | null;
  class: { id: string; name: string };
  subject: { id: string; name: string };
  _count: { submissions: number };
};

type Submission = {
  id: string;
  content: string | null;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
};

const EMPTY_FORM = { title: "", description: "", dueDate: "", maxScore: "", classId: "", subjectId: "" };

export default function TeacherAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [subsFor, setSubsFor] = useState<Assignment | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [grades, setGrades] = useState<Record<string, { grade: string; feedback: string }>>({});
  const [grading, setGrading] = useState<Record<string, boolean>>({});

  const load = () =>
    fetch("/api/assignments")
      .then((r) => r.ok && r.json())
      .then((d) => d?.assignments && setAssignments(d.assignments))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    fetch("/api/admin/classes").then((r) => r.ok && r.json()).then((d) => d?.classes && setClasses(d.classes)).catch(() => {});
    fetch("/api/admin/subjects").then((r) => r.ok && r.json()).then((d) => d?.subjects && setSubjects(d.subjects)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (a: Assignment) => {
    setEditing(a);
    setFormData({
      title: a.title,
      description: a.description ?? "",
      dueDate: a.dueDate.slice(0, 10),
      maxScore: a.maxScore != null ? String(a.maxScore) : "",
      classId: a.class.id,
      subjectId: a.subject.id,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.dueDate || !formData.classId || !formData.subjectId) {
      return toast({ title: "Title, due date, class, and subject are required", variant: "destructive" });
    }
    setSaving(true);
    try {
      const payload = { ...formData, maxScore: formData.maxScore ? Number(formData.maxScore) : undefined };
      const res = editing
        ? await fetch(`/api/assignments/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: editing ? "Assignment updated" : "Assignment created", variant: "success" });
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save assignment", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a: Assignment) => {
    try {
      const res = await fetch(`/api/assignments/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Assignment deleted", variant: "success" });
      load();
    } catch {
      toast({ title: "Failed to delete assignment", variant: "destructive" });
    }
  };

  const openSubmissions = async (a: Assignment) => {
    setSubsFor(a);
    setSubsLoading(true);
    setSubs([]);
    setGrades({});
    try {
      const res = await fetch(`/api/assignments/${a.id}/submissions`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSubs(data.submissions ?? []);
      const g: Record<string, { grade: string; feedback: string }> = {};
      (data.submissions ?? []).forEach((s: Submission) => {
        g[s.id] = { grade: s.grade != null ? String(s.grade) : "", feedback: s.feedback ?? "" };
      });
      setGrades(g);
    } catch {
      toast({ title: "Failed to load submissions", variant: "destructive" });
    } finally {
      setSubsLoading(false);
    }
  };

  const handleGrade = async (submissionId: string) => {
    const g = grades[submissionId];
    if (!g || g.grade === "") return toast({ title: "Enter a score", variant: "destructive" });
    setGrading((prev) => ({ ...prev, [submissionId]: true }));
    try {
      const res = await fetch(`/api/assignments/${subsFor!.id}/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: Number(g.grade), feedback: g.feedback || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Submission graded", variant: "success" });
      if (subsFor) openSubmissions(subsFor);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to grade", variant: "destructive" });
    } finally {
      setGrading((prev) => ({ ...prev, [submissionId]: false }));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Assignments
          </h2>
          <p className="text-muted-foreground">Create assignments and grade student submissions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Edit Assignment" : "Create Assignment"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>Title *</Label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class *</Label>
                  <Select value={formData.classId} onValueChange={(v) => setFormData({ ...formData, classId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject *</Label>
                  <Select value={formData.subjectId} onValueChange={(v) => setFormData({ ...formData, subjectId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Due Date *</Label><Input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} /></div>
                <div className="space-y-2"><Label>Max Score</Label><Input type="number" min={1} value={formData.maxScore} onChange={(e) => setFormData({ ...formData, maxScore: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Description</Label><Textarea rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editing ? "Save Changes" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />) :
          assignments.length === 0 ? (
            <Card className="md:col-span-2"><CardContent className="py-12 text-center">
              <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No assignments yet</p>
            </CardContent></Card>
          ) : assignments.map((a) => (
            <Card key={a.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {a.subject.name} · {a.class.name} · due {formatDate(a.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${a.title}`} onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDialog
                      title="Delete assignment?"
                      description={`"${a.title}" and all its submissions will be deleted.`}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${a.title}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                      onConfirm={() => handleDelete(a)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{a._count.submissions} submission{a._count.submissions === 1 ? "" : "s"}</Badge>
                  {a.maxScore && <span className="text-xs text-muted-foreground">Max {a.maxScore}</span>}
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => openSubmissions(a)}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Review Submissions
                </Button>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Submissions dialog */}
      <Dialog open={!!subsFor} onOpenChange={(open) => !open && setSubsFor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Submissions — {subsFor?.title}</DialogTitle></DialogHeader>
          {subsLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : subs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No submissions yet</p>
          ) : (
            <div className="space-y-3">
              {subs.map((s) => (
                <div key={s.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.student.firstName} {s.student.lastName}</p>
                      <p className="text-xs text-muted-foreground">{s.student.admissionNumber} · {formatDate(s.submittedAt)}</p>
                    </div>
                    {s.grade != null && <Badge variant="success">Graded: {s.grade}</Badge>}
                  </div>
                  {s.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{s.content}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Score ({subsFor?.maxScore ? `max ${subsFor.maxScore}` : "0-100"})</Label>
                      <Input type="number" min={0} value={grades[s.id]?.grade ?? ""}
                        onChange={(e) => setGrades((prev) => ({ ...prev, [s.id]: { ...(prev[s.id] ?? { grade: "", feedback: "" }), grade: e.target.value } }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Feedback</Label>
                      <Input value={grades[s.id]?.feedback ?? ""}
                        onChange={(e) => setGrades((prev) => ({ ...prev, [s.id]: { ...(prev[s.id] ?? { grade: "", feedback: "" }), feedback: e.target.value } }))} />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="gradient" disabled={grading[s.id]} onClick={() => handleGrade(s.id)}>
                      {grading[s.id] ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Save Grade
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
