"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Loader2, BookMarked, Copy, Check, Save, Trash2, FolderOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

type SavedPlan = {
  id: string;
  subject: string;
  class: string;
  topic: string;
  duration: string;
  objectives: string;
  materials: string;
  introduction: string;
  activities: string;
  teacherActivity: string;
  studentActivity: string;
  assessment: string;
  homework: string;
  createdAt: string;
};

export default function LessonPlansPage() {
  const [form, setForm] = useState({ subject: "", class: "", topic: "", duration: "40" });
  const [plan, setPlan] = useState<Record<string, string> | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadSaved = () =>
    fetch("/api/ai/lesson-plans")
      .then((r) => r.ok && r.json())
      .then((d) => d?.lessonPlans && setSavedPlans(d.lessonPlans))
      .catch(() => {});

  useEffect(() => {
    loadSaved();
  }, []);

  const handleGenerate = async () => {
    if (!form.subject || !form.class || !form.topic) {
      return toast({ title: "Please fill in all required fields", variant: "destructive" });
    }
    setLoading(true);
    setPlan(null);

    try {
      const res = await fetch("/api/ai/lesson-plan", {
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
      setPlan(data.plan);
    } catch {
      toast({ title: "Failed to generate lesson plan", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ai/lesson-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.subject,
          className: form.class,
          topic: form.topic,
          duration: form.duration,
          objectives: plan.objectives ?? "",
          materials: plan.materials ?? "",
          introduction: plan.introduction ?? "",
          activities: plan.activities ?? "",
          teacherActivity: plan.teacherActivity ?? "",
          studentActivity: plan.studentActivity ?? "",
          assessment: plan.assessment ?? "",
          homework: plan.homework ?? "",
        }),
      });
      const bodyText = await res.text();
      let data: any = null;
      try { data = bodyText ? JSON.parse(bodyText) : null; } catch { data = null; }
      if (!res.ok) {
        const serverMsg = data && (typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : "");
        const detail = bodyText && !serverMsg ? `: ${bodyText.slice(0, 200)}` : "";
        throw new Error(serverMsg || `AI request failed (${res.status})${detail}`);
      }
      toast({ title: "Lesson plan saved", variant: "success" });
      loadSaved();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save lesson plan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/lesson-plans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Lesson plan deleted", variant: "success" });
      loadSaved();
    } catch {
      toast({ title: "Failed to delete lesson plan", variant: "destructive" });
    }
  };

  const openSaved = (p: SavedPlan) => {
    setForm({ subject: p.subject, class: p.class, topic: p.topic, duration: p.duration });
    setPlan({
      topic: p.topic,
      objectives: p.objectives,
      materials: p.materials,
      introduction: p.introduction,
      activities: p.activities,
      teacherActivity: p.teacherActivity,
      studentActivity: p.studentActivity,
      assessment: p.assessment,
      homework: p.homework,
    });
  };

  const copyToClipboard = () => {
    if (!plan) return;
    const text = Object.entries(plan).map(([k, v]) => `${k.toUpperCase()}\n${v}`).join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({ title: "Copied to clipboard!", variant: "success" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" /> AI Lesson Plan Generator
        </h2>
        <p className="text-muted-foreground">Generate comprehensive lesson plans with AI in seconds</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2"><Label>Subject *</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Basic Science" /></div>
            <div className="space-y-2"><Label>Class *</Label><Input value={form.class} onChange={e => setForm({ ...form, class: e.target.value })} placeholder="e.g. Primary 5" /></div>
            <div className="space-y-2"><Label>Topic *</Label><Input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Digestive System" /></div>
            <div className="space-y-2"><Label>Duration (min)</Label>
              <Select value={form.duration} onValueChange={v => setForm({ ...form, duration: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["20", "30", "40", "45", "60", "80"].map(m => <SelectItem key={m} value={m}>{m} min</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={loading} className="mt-4" variant="gradient">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Brain className="mr-2 h-4 w-4" /> Generate Lesson Plan</>}
          </Button>
        </CardContent>
      </Card>

      {plan && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookMarked className="h-5 w-5 text-primary" />
              {form.subject}: {form.topic}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? <><Check className="mr-1 h-4 w-4" /> Copied</> : <><Copy className="mr-1 h-4 w-4" /> Copy</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(plan).map(([key, value]) => (
              <div key={key}>
                <h4 className="text-sm font-semibold text-primary mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{value}</p>
              </div>
            ))}
            <div className="pt-4 border-t flex justify-end">
              <Button variant="gradient" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Lesson Plan</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!plan && !loading && (
        <Card className="gradient-card border-primary/10">
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 mx-auto text-primary/60 mb-4" />
            <h3 className="text-lg font-semibold mb-2">AI-Powered Lesson Planning</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Fill in the subject, class, and topic. Our AI will generate a complete lesson plan
              with objectives, materials, activities, assessments, and homework.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Saved plans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" /> Saved Lesson Plans ({savedPlans.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {savedPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No saved plans yet</p>
          ) : (
            <div className="space-y-2">
              {savedPlans.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.topic} <span className="text-muted-foreground">— {p.subject}, {p.class}</span></p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openSaved(p)}>
                      <FolderOpen className="mr-1 h-3 w-3" /> Open
                    </Button>
                    <ConfirmDialog
                      title="Delete lesson plan?"
                      description={`"${p.topic}" will be permanently deleted.`}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${p.topic}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                      onConfirm={() => handleDelete(p.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
