"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Loader2, Sparkles, GraduationCap, ClipboardCheck, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";

type Metrics = {
  overallAverage: number | null;
  subjectAverages: { subject: string; average: number | null; results: number }[];
  trend: { label: string; average: number | null }[];
  attendanceRate: number | null;
  homework: { assigned: number; submitted: number; rate: number | null };
  assignments: { assigned: number; submitted: number; rate: number | null };
  behaviourNotes: { event: string; note: string | null; date: string }[];
};
type Analysis = {
  strengths: string[];
  weakSubjects: string[];
  recommendations: string[];
  learningPattern: string;
  improvementPlan: string[];
  trendSummary: string;
};

/**
 * AI Performance Analyzer — student portal (self) and parent portal
 * (child). The parent page passes studentId; student page uses own id
 * resolved from /api/ai/students.
 */
export function PerformanceAnalyzer({ studentId, title = "AI Performance Analysis" }: { studentId?: string; title?: string }) {
  const [ownId, setOwnId] = useState<string | null>(studentId ?? null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!studentId) {
      fetch("/api/ai/students")
        .then((r) => r.json())
        .then((d) => {
          if (d.students?.[0]) setOwnId(d.students[0].id);
        })
        .catch(() => {});
    }
  }, [studentId]);

  const analyze = async () => {
    if (!ownId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: ownId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setMetrics(data.metrics);
      setAnalysis(data.analysis);
      setLoaded(true);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Analysis failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" /> {title}
          </h2>
          <p className="text-muted-foreground">Real results, attendance and homework data — explained by AI</p>
        </div>
        <Button variant="gradient" onClick={analyze} disabled={loading || !ownId}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {loaded ? "Re-analyze" : "Analyze my performance"}
        </Button>
      </div>

      {loading && <Skeleton className="h-72" />}

      {metrics && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Overall average</p>
                <p className="mt-1 text-3xl font-bold">{metrics.overallAverage ?? "—"}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Attendance</p>
                <p className="mt-1 text-3xl font-bold">{metrics.attendanceRate ?? "—"}%</p>
                <Progress value={metrics.attendanceRate ?? 0} className="mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Homework completion</p>
                <p className="mt-1 text-3xl font-bold">{metrics.homework.rate ?? "—"}%</p>
                <p className="text-xs text-muted-foreground mt-1">{metrics.homework.submitted}/{metrics.homework.assigned} submitted</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Subject performance</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {metrics.subjectAverages.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No published results yet.</p>
                ) : (
                  metrics.subjectAverages.map((s) => (
                    <div key={s.subject}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{s.subject}</span>
                        <span className="text-muted-foreground">{s.average ?? "—"}%</span>
                      </div>
                      <Progress value={s.average ?? 0} className="h-2" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><NotebookPen className="h-4 w-4" /> Term trend</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {metrics.trend.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Not enough data for a trend yet.</p>
                ) : (
                  metrics.trend.map((t) => (
                    <div key={t.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{t.label}</span>
                        <span className="text-muted-foreground">{t.average ?? "—"}%</span>
                      </div>
                      <Progress value={t.average ?? 0} className="h-2" />
                    </div>
                  ))
                )}
                {metrics.behaviourNotes.length > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs">
                    <p className="font-semibold mb-1">Recent activity notes</p>
                    {metrics.behaviourNotes.slice(0, 3).map((n, i) => (
                      <p key={i} className="text-muted-foreground">• {n.event}{n.note ? ` — ${n.note}` : ""}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {analysis && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI analysis</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {analysis.trendSummary && (
                  <p className="rounded-lg bg-primary/5 px-3 py-2 text-primary">{analysis.trendSummary}</p>
                )}
                {analysis.strengths.length > 0 && (
                  <div>
                    <p className="font-semibold mb-1">Strengths</p>
                    <ul className="list-disc pl-5 space-y-0.5">{analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {analysis.weakSubjects.length > 0 && (
                  <div>
                    <p className="font-semibold mb-1">Subjects to focus on</p>
                    <ul className="list-disc pl-5 space-y-0.5">{analysis.weakSubjects.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {analysis.learningPattern && (
                  <div className="rounded-lg bg-muted/50 p-3"><span className="font-semibold">Learning pattern: </span>{analysis.learningPattern}</div>
                )}
                {analysis.improvementPlan.length > 0 && (
                  <div>
                    <p className="font-semibold mb-1">Improvement plan</p>
                    <ol className="list-decimal pl-5 space-y-0.5">{analysis.improvementPlan.map((s, i) => <li key={i}>{s}</li>)}</ol>
                  </div>
                )}
                {analysis.recommendations.length > 0 && (
                  <div>
                    <p className="font-semibold mb-1">Recommendations</p>
                    <ul className="list-disc pl-5 space-y-0.5">{analysis.recommendations.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {analysis.strengths.length === 0 && analysis.weakSubjects.length === 0 && (
                  <p className="text-muted-foreground">Insufficient data for a full analysis.</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {loaded && !metrics && <p className="text-muted-foreground">No data available yet.</p>}
      <Badge variant="secondary" className="hidden">{title}</Badge>
    </div>
  );
}
