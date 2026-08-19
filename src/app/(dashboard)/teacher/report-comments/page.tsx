"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, RefreshCw, Edit3, Check, Save, Trash2, FolderOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

type StudentOption = { id: string; firstName: string; lastName: string; admissionNumber: string };
type SavedComment = {
  id: string;
  content: string;
  createdAt: string;
  student: { firstName: string; lastName: string; admissionNumber: string };
};

export default function ReportCommentsPage() {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [form, setForm] = useState({ studentId: "", name: "", mathScore: "", englishScore: "", attendance: "", behaviour: "Good" });
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedComment, setEditedComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedComments, setSavedComments] = useState<SavedComment[]>([]);

  const loadSaved = () =>
    fetch("/api/ai/report-comments")
      .then((r) => r.ok && r.json())
      .then((d) => d?.comments && setSavedComments(d.comments))
      .catch(() => {});

  useEffect(() => {
    fetch("/api/admin/students?limit=100")
      .then((r) => r.ok && r.json())
      .then((d) => d?.students && setStudents(d.students))
      .catch(() => {});
    loadSaved();
  }, []);

  const handleGenerate = async () => {
    if (!form.name) return toast({ title: "Student name is required", variant: "destructive" });
    setLoading(true);
    setComment("");

    try {
      const res = await fetch("/api/ai/report-comment", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const bodyText = await res.text();
      let data: any = null;
      try { data = bodyText ? JSON.parse(bodyText) : null; } catch { data = null; }
      if (!res.ok) {
        const serverMsg = data && (typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : "");
        const detail = bodyText && !serverMsg ? `: ${bodyText.slice(0, 200)}` : "";
        throw new Error(serverMsg || `AI request failed (${res.status})${detail}`);
      }
      setComment(data.comment);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to generate comment", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const text = editing ? editedComment : comment;
    if (!text) return toast({ title: "Nothing to save", variant: "destructive" });
    if (!form.studentId) {
      return toast({ title: "Select the student this comment is for", variant: "destructive" });
    }
    setSaving(true);
    try {
      const res = await fetch("/api/ai/report-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: form.studentId, comment: text }),
      });
      const bodyText = await res.text();
      let data: any = null;
      try { data = bodyText ? JSON.parse(bodyText) : null; } catch { data = null; }
      if (!res.ok) {
        const serverMsg = data && (typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : "");
        const detail = bodyText && !serverMsg ? `: ${bodyText.slice(0, 200)}` : "";
        throw new Error(serverMsg || `AI request failed (${res.status})${detail}`);
      }
      toast({ title: "Comment saved", variant: "success" });
      setEditing(false);
      loadSaved();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save comment", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/report-comments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Comment deleted", variant: "success" });
      loadSaved();
    } catch {
      toast({ title: "Failed to delete comment", variant: "destructive" });
    }
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> AI Report Comment Generator
        </h2>
        <p className="text-muted-foreground">Generate personalized report comments for students in seconds</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Student Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Student (for saving)</Label>
              <Select value={form.studentId} onValueChange={(v) => {
                const s = students.find((x) => x.id === v);
                setForm({ ...form, studentId: v, name: s ? `${s.firstName} ${s.lastName}` : form.name });
              }}>
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
            <div className="space-y-2"><Label>Student Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. John Doe" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Mathematics (%)</Label><Input type="number" value={form.mathScore} onChange={e => setForm({ ...form, mathScore: e.target.value })} /></div>
              <div className="space-y-2"><Label>English (%)</Label><Input type="number" value={form.englishScore} onChange={e => setForm({ ...form, englishScore: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Attendance (%)</Label><Input type="number" value={form.attendance} onChange={e => setForm({ ...form, attendance: e.target.value })} /></div>
              <div className="space-y-2"><Label>Behaviour</Label>
                <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.behaviour} onChange={e => setForm({ ...form, behaviour: e.target.value })}>
                  <option value="Excellent">Excellent</option><option value="Good">Good</option><option value="Satisfactory">Satisfactory</option><option value="Needs Improvement">Needs Improvement</option>
                </select>
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={loading} className="w-full" variant="gradient">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate Comment</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Generated Comment</CardTitle>
            <div className="flex gap-2">
              {comment && !editing && <Button variant="outline" size="sm" onClick={() => { setEditedComment(comment); setEditing(true); }}><Edit3 className="h-4 w-4 mr-1" /> Edit</Button>}
              {comment && !editing && <Button variant="outline" size="sm" onClick={handleRegenerate}><RefreshCw className="h-4 w-4 mr-1" /> Regenerate</Button>}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : editing ? (
              <div className="space-y-4">
                <Textarea rows={6} value={editedComment} onChange={e => setEditedComment(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Check className="mr-2 h-4 w-4" /> Save</>}
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : comment ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm leading-relaxed">{comment}</p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Comment</>}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Enter student details and click generate to create a personalized report comment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Saved comments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" /> Saved Comments ({savedComments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {savedComments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No saved comments yet</p>
          ) : (
            <div className="space-y-2">
              {savedComments.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {c.student.firstName} {c.student.lastName}{" "}
                      <span className="text-muted-foreground">({c.student.admissionNumber})</span>
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{c.content}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{formatDateTime(c.createdAt)}</p>
                  </div>
                  <ConfirmDialog
                    title="Delete comment?"
                    description="This comment will be permanently deleted."
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" aria-label="Delete comment">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                    onConfirm={() => handleDelete(c.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
