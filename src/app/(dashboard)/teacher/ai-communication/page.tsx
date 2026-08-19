"use client";

import { useEffect, useState } from "react";
import { MessageSquareHeart, Loader2, Send, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Student = { id: string; name: string; className: string | null };

const SCENARIOS = [
  { value: "PROGRESS_REPORT", label: "Progress report" },
  { value: "ATTENDANCE_WARNING", label: "Attendance warning" },
  { value: "CONGRATULATIONS", label: "Congratulations" },
  { value: "REMINDER", label: "Reminder" },
  { value: "BEHAVIOR_REPORT", label: "Behaviour report" },
];

export default function TeacherAiCommunicationPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [scenario, setScenario] = useState("PROGRESS_REPORT");
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState("");
  const [parentName, setParentName] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(true);

  useEffect(() => {
    fetch("/api/ai/students")
      .then((r) => parseJsonBody(r))
      .then((d) => {
        setStudents(d.students ?? []);
        if (d.students?.length) setStudentId(d.students[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, []);

  const generate = async () => {
    if (!studentId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/parent-communication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, scenario, notes: notes.trim() || undefined }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setDraft(data.draft);
      setParentName(`parent of ${data.student.name}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Generation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/ai/parent-communication/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, subject: SCENARIOS.find((s) => s.value === scenario)?.label ?? "Message from school", content: draft.trim() }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Send failed");
      toast({ title: `Message delivered to ${data.to}`, variant: "success" });
      setDraft("");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Send failed", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquareHeart className="h-6 w-6 text-primary" /> Parent Communication Assistant
        </h2>
        <p className="text-muted-foreground">AI-drafted messages, editable before sending through EduFlow messaging</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Draft a message</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Student</Label>
              {loadingStudents ? (
                <Skeleton className="h-9" />
              ) : (
                <Select value={studentId || undefined} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder="Select student…" /></SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} — {s.className ?? "No class"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Scenario</Label>
              <Select value={scenario} onValueChange={setScenario}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCENARIOS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Extra notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. mention the upcoming science fair" />
          </div>
          <Button variant="gradient" onClick={generate} disabled={generating || !studentId}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Generate draft
          </Button>
        </CardContent>
      </Card>

      {draft && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Draft — edit before sending {parentName && <span className="text-muted-foreground font-normal">({parentName})</span>}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft("")}>Discard</Button>
              <Button variant="gradient" onClick={send} disabled={sending || !draft.trim()}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send to parent
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
