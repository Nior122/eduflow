"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Loader2, Users, Activity, GraduationCap, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";

type Student = { id: string; name: string; admissionNumber: string; className: string | null; attendanceRate: number | null; averageScore: number | null };
type Metrics = {
  overallAverage: number | null;
  subjectAverages: { subject: string; average: number | null; results: number }[];
  trend: { label: string; average: number | null }[];
  attendanceRate: number | null;
  homework: { assigned: number; submitted: number; rate: number | null };
  assignments: { assigned: number; submitted: number; rate: number | null };
  behaviourNotes: { event: string; note: string | null; date: string }[];
};
type Narrative = { summary: string; factors: string[]; interventions: string[]; teacherAction: string; parentFollowUp: string };

const RISK_STYLES: Record<string, string> = {
  LOW: "bg-emerald-500/15 text-emerald-600",
  MEDIUM: "bg-amber-500/15 text-amber-600",
  HIGH: "bg-destructive/15 text-destructive",
};

export default function TeacherAiRiskPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [save, setSave] = useState(true);
  const [result, setResult] = useState<{ riskScore: number; dropoutRisk: string; failureRisk: string; metrics: Metrics; narrative: Narrative } | null>(null);

  useEffect(() => {
    fetch("/api/ai/students")
      .then((r) => r.json())
      .then((d) => {
        setStudents(d.students ?? []);
        if (d.students?.length) setStudentId(d.students[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, []);

  const analyze = async () => {
    if (!studentId) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, save }),
      });
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!res.ok) throw new Error((data && typeof data.error === "string" && data.error) || `AI request failed (${res.status})`);
      setResult(data);
      if (data.saved) toast({ title: "Analysis saved to the student's profile", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Analysis failed", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" /> Student Risk Prediction
        </h2>
        <p className="text-muted-foreground">Attendance, grades, homework and behaviour — scored and explained</p>
      </div>

      <Card>
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          {loadingStudents ? (
            <Skeleton className="h-9 w-64" />
          ) : (
            <Select value={studentId || undefined} onValueChange={setStudentId}>
              <SelectTrigger className="sm:w-80"><SelectValue placeholder="Select student…" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — {s.className ?? "No class"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setSave(!save)}>
            {save ? "Will save to profile" : "Don't save"}
          </Button>
          <Button variant="gradient" onClick={analyze} disabled={analyzing || !studentId}>
            {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
            Analyze risk
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Risk score</p>
                <p className="mt-1 text-4xl font-bold">{result.riskScore}<span className="text-lg text-muted-foreground">/100</span></p>
                <Progress value={result.riskScore} className="mt-3" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Dropout risk</p>
                <p className="mt-2"><Badge className={RISK_STYLES[result.dropoutRisk] ?? ""}>{result.dropoutRisk}</Badge></p>
                <p className="mt-3 text-xs text-muted-foreground">Failure risk: <Badge className={RISK_STYLES[result.failureRisk] ?? ""}>{result.failureRisk}</Badge></p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-1.5 text-sm">
                <p className="text-sm text-muted-foreground">Key signals</p>
                <p className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-muted-foreground" /> Avg: {result.metrics.overallAverage ?? "—"}%</p>
                <p className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-muted-foreground" /> Attendance: {result.metrics.attendanceRate ?? "—"}%</p>
                <p className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Homework: {result.metrics.homework.rate ?? "—"}%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">AI explanation & interventions</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-wrap">{result.narrative.summary}</p>
              {result.narrative.factors.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Contributing factors</p>
                  <ul className="list-disc pl-5 space-y-0.5">{result.narrative.factors.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </div>
              )}
              {result.narrative.interventions.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Suggested interventions</p>
                  <ul className="list-disc pl-5 space-y-0.5">{result.narrative.interventions.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </div>
              )}
              {result.narrative.teacherAction && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <span className="font-semibold">Recommended teacher action: </span>{result.narrative.teacherAction}
                </div>
              )}
              {result.narrative.parentFollowUp && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <span className="font-semibold">Parent follow-up: </span>{result.narrative.parentFollowUp}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
