"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Plus, Loader2, Copy, Archive, Rocket, Pencil, Trash2, CalendarClock } from "lucide-react";

type Examination = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  startDate: string | null;
  endDate: string | null;
  session: { name: string };
  term: { name: string };
  classes: { class: { id: string; name: string } }[];
  _count: { scores: number };
};

type Session = { id: string; name: string };
type Term = { id: string; name: string };
type ClassRow = { id: string; name: string };

const TYPE_LABEL: Record<string, string> = {
  CA: "Continuous Assessment",
  MID_TERM: "Mid-Term",
  FINAL: "Final Examination",
  MOCK: "Mock Examination",
  PROMOTION: "Promotion Examination",
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  ARCHIVED: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const emptyForm = {
  name: "",
  type: "CA",
  description: "",
  status: "DRAFT",
  startDate: "",
  endDate: "",
  sessionId: "",
  termId: "",
  classIds: [] as string[],
};

export default function ExaminationsPage() {
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [examRes, sessionRes, classRes] = await Promise.all([
        fetch(`/api/examinations${filterStatus ? `?status=${filterStatus}` : ""}`),
        fetch("/api/admin/sessions"),
        fetch("/api/admin/classes"),
      ]);
      const examData = await examRes.json();
      const sessionData = await sessionRes.json();
      const classData = await classRes.json();
      setExaminations(examData.examinations ?? []);
      setSessions(sessionData.sessions ?? []);
      setClasses(classData.classes ?? []);
      if (sessionData.sessions?.[0]) {
        setForm((f) => (f.sessionId ? f : { ...f, sessionId: sessionData.sessions[0].id }));
      }
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const loadTerms = async (sessionId: string) => {
    if (!sessionId) return;
    const res = await fetch(`/api/admin/terms?sessionId=${sessionId}`);
    const data = await res.json();
    setTerms(data.terms ?? []);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, sessionId: sessions[0]?.id ?? "" });
    if (sessions[0]) loadTerms(sessions[0].id);
    setDialogOpen(true);
  };

  const openEdit = (ex: Examination) => {
    setEditingId(ex.id);
    setForm({
      name: ex.name,
      type: ex.type,
      description: ex.description ?? "",
      status: ex.status,
      startDate: ex.startDate ? ex.startDate.slice(0, 10) : "",
      endDate: ex.endDate ? ex.endDate.slice(0, 10) : "",
      sessionId: sessions.find((s) => s.name === ex.session.name)?.id ?? "",
      termId: terms.find((t) => t.name === ex.term.name)?.id ?? "",
      classIds: ex.classes.map((c) => c.class.id),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        ...form,
        classIds: form.classIds.length ? form.classIds : undefined,
      };
      const res = await fetch(editingId ? `/api/examinations/${editingId}` : "/api/examinations", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast({ title: editingId ? "Examination updated" : "Examination created" });
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const action = async (id: string, path: string, successMsg: string) => {
    try {
      const res = await fetch(`/api/examinations/${id}/${path}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      toast({ title: successMsg });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Action failed", variant: "destructive" });
    }
  };

  const duplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/examinations/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Duplicate failed");
      toast({ title: "Examination duplicated (DRAFT)" });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Duplicate failed", variant: "destructive" });
    }
  };

  const remove = async (ex: Examination) => {
    try {
      const res = await fetch(`/api/examinations/${ex.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast({ title: "Examination deleted" });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Delete failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Examination Management</h2>
          <p className="text-sm text-muted-foreground">Create, activate, archive and duplicate examinations per session &amp; term.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Examination</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : examinations.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No examinations yet — create your first one.</div>
          ) : (
            <div className="divide-y">
              {examinations.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{ex.name}</p>
                      <Badge className={STATUS_BADGE[ex.status]}>{ex.status}</Badge>
                      <Badge variant="secondary">{TYPE_LABEL[ex.type] ?? ex.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ex.session.name} · Term {ex.term.name} · {ex.classes.length} class(es) · {ex._count.scores} score(s)
                      {ex.startDate ? ` · ${ex.startDate.slice(0, 10)} → ${ex.endDate?.slice(0, 10) ?? "—"}` : ""}
                    </p>
                    {ex.classes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ex.classes.map((c) => (
                          <span key={c.class.id} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{c.class.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {ex.status !== "ACTIVE" && (
                      <Button size="sm" variant="outline" onClick={() => action(ex.id, "activate", "Examination activated")}>
                        <Rocket className="h-4 w-4" />
                      </Button>
                    )}
                    {ex.status !== "ARCHIVED" && (
                      <Button size="sm" variant="outline" onClick={() => action(ex.id, "archive", "Examination archived")}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => duplicate(ex.id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(ex)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant="outline" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                      title="Delete examination?"
                      description={`"${ex.name}" will be permanently removed. Examinations with entered scores cannot be deleted — archive them instead.`}
                      confirmLabel="Delete"
                      onConfirm={() => remove(ex)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Examination" : "Create Examination"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. First Term Examination" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CA">Continuous Assessment</SelectItem>
                    <SelectItem value="MID_TERM">Mid-Term</SelectItem>
                    <SelectItem value="FINAL">Final Examination</SelectItem>
                    <SelectItem value="MOCK">Mock Examination</SelectItem>
                    <SelectItem value="PROMOTION">Promotion Examination</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Session</Label>
                <Select
                  value={form.sessionId}
                  onValueChange={(v) => { setForm({ ...form, sessionId: v }); loadTerms(v); }}
                >
                  <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Term</Label>
                <Select value={form.termId} onValueChange={(v) => setForm({ ...form, termId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                  <SelectContent>
                    {terms.map((t) => <SelectItem key={t.id} value={t.id}>Term {t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Classes ({form.classIds.length} selected)</Label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border rounded-lg p-2">
                {classes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        classIds: form.classIds.includes(c.id)
                          ? form.classIds.filter((x) => x !== c.id)
                          : [...form.classIds, c.id],
                      })
                    }
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.classIds.includes(c.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button className="w-full" onClick={save} disabled={saving || !form.name || !form.sessionId || !form.termId}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-1" />}
              {saving ? "Saving…" : "Save Examination"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
