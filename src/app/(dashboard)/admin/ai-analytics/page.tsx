"use client";

import { useState } from "react";
import { BarChart3, Loader2, Sparkles, TrendingDown, TrendingUp, AlertTriangle, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";

type Metrics = {
  snapshot: { students: number; teachers: number; classes: number; outstandingFees: number };
  subjectPerformance: { subject: string; average: number; results: number }[];
  classComparison: { name: string; average: number; results: number }[];
  teacherPerformance: { name: string; average: number; results: number }[];
  attendanceTrend: { week: string; rate: number }[];
  feeTrend: { week: string; amount: number }[];
  atRisk: { name: string; className: string | null; average: number | null; attendanceRate: number | null }[];
};
type Summary = { headline: string; insights: string[]; recommendations: string[]; riskNote: string };

export default function AdminAiAnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    setSummary(null);
    try {
      const res = await fetch("/api/ai/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeSummary: true }),
      });
      const bodyText = await res.text();
      let data: any = null;
      try { data = bodyText ? JSON.parse(bodyText) : null; } catch { data = null; }
      if (!res.ok) throw new Error((data && typeof data.error === "string" && data.error) || `AI request failed (${res.status})`);
      setMetrics(data.metrics);
      setSummary(data.summary);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Analysis failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const Bar = ({ label, value, max }: { label: string; value: number; max: number }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="truncate font-medium">{label}</span>
        <span className="text-muted-foreground shrink-0">{value}%</span>
      </div>
      <Progress value={max ? (value / max) * 100 : 0} className="h-2" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> AI School Analytics
          </h2>
          <p className="text-muted-foreground">Real metrics with an AI executive summary</p>
        </div>
        <Button variant="gradient" onClick={analyze} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {metrics ? "Refresh analysis" : "Analyze school"}
        </Button>
      </div>

      {loading && <Card><CardContent className="py-16 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Crunching the numbers…</p></CardContent></Card>}

      {metrics && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Students</p><p className="mt-1 text-3xl font-bold">{metrics.snapshot.students}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Teachers</p><p className="mt-1 text-3xl font-bold">{metrics.snapshot.teachers}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Classes</p><p className="mt-1 text-3xl font-bold">{metrics.snapshot.classes}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Outstanding fees</p><p className="mt-1 text-3xl font-bold text-destructive">₦{metrics.snapshot.outstandingFees.toLocaleString()}</p></CardContent></Card>
          </div>

          {summary && (
            <Card className="border-primary/30">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Executive summary</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="font-semibold text-primary">{summary.headline}</p>
                {summary.insights.length > 0 && (
                  <ul className="list-disc pl-5 space-y-0.5">{summary.insights.map((s, i) => <li key={i}>{s}</li>)}</ul>
                )}
                {summary.recommendations.length > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="font-semibold mb-1">Prioritized actions</p>
                    <ol className="list-decimal pl-5 space-y-0.5">{summary.recommendations.map((s, i) => <li key={i}>{s}</li>)}</ol>
                  </div>
                )}
                {summary.riskNote && (
                  <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" /> {summary.riskNote}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" /> Most difficult subjects</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {metrics.subjectPerformance.slice(0, 6).map((s) => (
                  <Bar key={s.subject} label={s.subject} value={s.average} max={100} />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500" /> Best performing teachers</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {metrics.teacherPerformance.slice(0, 6).map((t) => (
                  <Bar key={t.name} label={t.name} value={t.average} max={100} />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Attendance trend (12 weeks)</CardTitle></CardHeader>
              <CardContent className="flex items-end gap-1.5 h-28">
                {metrics.attendanceTrend.map((w) => (
                  <div key={w.week} className="flex-1 flex flex-col items-center gap-1" title={`${w.week}: ${w.rate}%`}>
                    <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(6, w.rate)}%` }} />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Fee collection trend (12 weeks)</CardTitle></CardHeader>
              <CardContent className="flex items-end gap-1.5 h-28">
                {metrics.feeTrend.map((w) => (
                  <div key={w.week} className="flex-1 flex flex-col items-center gap-1" title={`${w.week}: ₦${w.amount.toLocaleString()}`}>
                    <div className="w-full rounded-t bg-emerald-500/70" style={{ height: `${Math.min(100, Math.max(4, (w.amount / (Math.max(...metrics.feeTrend.map((f) => f.amount), 1))) * 100))}%` }} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Students requiring intervention ({metrics.atRisk.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {metrics.atRisk.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No at-risk students detected 🎉</p>
              ) : (
                metrics.atRisk.map((s) => (
                  <div key={s.name + s.className} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.className ?? "—"}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Badge variant="secondary">Avg {s.average ?? "—"}%</Badge>
                      <Badge className={s.attendanceRate != null && s.attendanceRate < 75 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}>
                        Att {s.attendanceRate ?? "—"}%
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
