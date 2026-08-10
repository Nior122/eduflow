"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Wand2, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type ExamMeta = {
  id: string;
  title: string;
  subject: string | null;
  className: string | null;
  durationMins: number | null;
  createdAt: string;
};

export default function TeacherAiExamsPage() {
  const [subject, setSubject] = useState("");
  const [className, setClassName] = useState("");
  const [topic, setTopic] = useState("");
  const [durationMins, setDurationMins] = useState("60");
  const [generating, setGenerating] = useState(false);
  const [exams, setExams] = useState<ExamMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ai/exams")
      .then((r) => r.json())
      .then((d) => setExams(d.exams ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const generate = async () => {
    if (!subject.trim() || !topic.trim()) {
      return toast({ title: "Subject and topic are required", variant: "destructive" });
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), className: className.trim() || undefined, topic: topic.trim(), durationMins: Number(durationMins) || 60 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      toast({ title: "Exam generated", variant: "success" });
      setExams((prev) => [data.exam, ...prev]);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Generation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/exams/${id}`, { method: "DELETE" });
      if (res.ok) {
        setExams((prev) => prev.filter((e) => e.id !== id));
        toast({ title: "Exam deleted" });
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" /> AI Exam Generator
        </h2>
        <p className="text-muted-foreground">Complete papers with instructions, marking scheme and answer key</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Generate exam</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" />
            </div>
            <div className="space-y-1.5">
              <Label>Class (optional)</Label>
              <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="SS 1A" />
            </div>
            <div className="space-y-1.5">
              <Label>Topic / scope</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Algebra & Equations" />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Select value={durationMins} onValueChange={setDurationMins}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["30", "45", "60", "90", "120"].map((m) => (
                    <SelectItem key={m} value={m}>{m} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="gradient" onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Generate exam
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Generated exams ({exams.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <Skeleton className="h-32" />
          ) : exams.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No exams generated yet.</p>
          ) : (
            exams.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.subject ?? "—"} · {e.className ?? "General"} · {e.durationMins ? `${e.durationMins} min` : "—"} · {formatDate(e.createdAt)}
                  </p>
                </div>
                <Link href={`/teacher/ai-exams/${e.id}`}>
                  <Button variant="outline" size="sm"><Eye className="mr-1 h-3.5 w-3.5" /> View / Print</Button>
                </Link>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(e.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
