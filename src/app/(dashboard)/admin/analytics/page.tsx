"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { BarChart3, TrendingUp, Trophy, AlertTriangle } from "lucide-react";

type Session = { id: string; name: string; terms: { id: string; name: string }[] };
type ClassRow = { id: string; name: string };

type SubjectStat = {
  subjectId: string;
  subjectName: string;
  average: number;
  passRate: number;
  failRate: number;
  max: number;
  min: number;
  students: number;
};

type Analytics = {
  className: string;
  studentCount: number;
  overallAverage: number;
  passRate: number;
  failRate: number;
  bestSubject: SubjectStat | null;
  weakestSubject: SubjectStat | null;
  subjects: SubjectStat[];
  distribution: { A: number; B: number; C: number; D: number; E: number; F: number };
};

type TrendPoint = { sessionName: string; termName: string; overallAverage: number; passRate: number; students: number };
type SchoolAnalytics = {
  classes: { classId: string; className: string; overallAverage: number; passRate: number }[];
  topSubjects: { subjectName: string; average: number }[];
  weakSubjects: { subjectName: string; average: number }[];
  subjectComparison: { subjectName: string; average: number; students: number }[];
  totalResults: number;
};

const DIST_COLORS: Record<string, string> = {
  A: "bg-green-500", B: "bg-emerald-400", C: "bg-yellow-400", D: "bg-amber-400", E: "bg-orange-400", F: "bg-red-500",
};

export default function AnalyticsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [school, setSchool] = useState<SchoolAnalytics | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/sessions").then((r) => r.json()),
      fetch("/api/admin/classes").then((r) => r.json()),
    ]).then(([s, c]) => {
      setSessions(s.sessions ?? []);
      setClasses(c.classes ?? []);
      if (s.sessions?.[0]) {
        setSessionId(s.sessions[0].id);
        setTermId(s.sessions[0].terms?.[0]?.id ?? "");
      }
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!sessionId || !termId) return;
    setLoading(true);
    try {
      if (classId) {
        const [aRes, tRes] = await Promise.all([
          fetch(`/api/analytics?classId=${classId}&sessionId=${sessionId}&termId=${termId}`),
          fetch(`/api/analytics?classId=${classId}`),
        ]);
        const aData = await aRes.json();
        const tData = await tRes.json();
        setAnalytics(aData.analytics ?? null);
        setTrend(tData.trend ?? []);
        setSchool(null);
      } else {
        const res = await fetch(`/api/analytics?sessionId=${sessionId}&termId=${termId}`);
        const data = await res.json();
        setSchool(data.analytics ?? null);
        setAnalytics(null);
        setTrend([]);
      }
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to load analytics", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [sessionId, termId, classId]);

  const Bar = ({ label, value, max = 100, color = "bg-primary" }: { label: string; value: number; max?: number; color?: string }) => (
    <div className="flex items-center gap-3">
      <span className="w-36 text-xs text-muted-foreground truncate text-right">{label}</span>
      <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
        <div className={`h-full rounded ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
      <span className="w-14 text-xs font-semibold">{value.toFixed ? value.toFixed(1) : value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Analytics</h2>
          <p className="text-sm text-muted-foreground">Class averages, pass/fail rates, subject comparison and term trends.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Session</Label>
              <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setTermId(sessions.find((s) => s.id === v)?.terms?.[0]?.id ?? ""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Term</Label>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sessions.find((s) => s.id === sessionId)?.terms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>Term {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Class (blank = whole school)</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Whole school</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={load} disabled={!sessionId || !termId || loading}>
                {loading ? <Loader2Spinner /> : <BarChart3 className="h-4 w-4 mr-1" />}
                Load
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : analytics ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{analytics.className} average</p>
              <p className="text-3xl font-bold mt-1">{analytics.overallAverage.toFixed(1)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Pass rate</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{analytics.passRate.toFixed(1)}%</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Failure rate</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{analytics.failRate.toFixed(1)}%</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Students</p>
              <p className="text-3xl font-bold mt-1">{analytics.studentCount}</p>
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Subject comparison</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                {analytics.subjects.map((s) => (
                  <Bar key={s.subjectId} label={s.subjectName} value={s.average} color={s.average >= 50 ? "bg-green-500" : "bg-red-400"} />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Grade distribution</CardTitle></CardHeader>
              <CardContent>
                <div className="flex h-8 rounded overflow-hidden border">
                  {(["A", "B", "C", "D", "E", "F"] as const).map((g) => {
                    const count = analytics.distribution[g];
                    const total = Object.values(analytics.distribution).reduce((a, b) => a + b, 0);
                    const pct = total ? (count / total) * 100 : 0;
                    return (
                      <div key={g} className={`${DIST_COLORS[g]} flex items-center justify-center text-xs font-bold text-white`} style={{ width: `${pct}%` }} title={`${g}: ${count}`}>
                        {pct > 4 ? `${g} ${count}` : ""}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-6 gap-2 mt-3">
                  {(["A", "B", "C", "D", "E", "F"] as const).map((g) => (
                    <div key={g} className="text-center">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${DIST_COLORS[g]} mr-1`} />
                      <span className="text-xs">{g}: {analytics.distribution[g]}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="rounded-lg border p-3 flex items-start gap-2">
                    <Trophy className="h-4 w-4 text-green-600 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Best subject</p>
                      <p className="text-sm font-semibold truncate">{analytics.bestSubject?.subjectName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{analytics.bestSubject?.average.toFixed(1) ?? ""} avg · {analytics.bestSubject?.passRate.toFixed(0) ?? ""}% pass</p>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Weakest subject</p>
                      <p className="text-sm font-semibold truncate">{analytics.weakestSubject?.subjectName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{analytics.weakestSubject?.average.toFixed(1) ?? ""} avg · {analytics.weakestSubject?.failRate.toFixed(0) ?? ""}% fail</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {trend.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Class performance trend</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                {trend.map((t, i) => (
                  <Bar key={i} label={`${t.sessionName} · T${t.termName}`} value={t.overallAverage} />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : school ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Results processed</p>
              <p className="text-3xl font-bold mt-1">{school.totalResults}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Top subject</p>
              <p className="text-lg font-bold mt-1 truncate">{school.topSubjects[0]?.subjectName ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{school.topSubjects[0]?.average.toFixed(1) ?? ""}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Weakest subject</p>
              <p className="text-lg font-bold mt-1 truncate">{school.weakSubjects[0]?.subjectName ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{school.weakSubjects[0]?.average.toFixed(1) ?? ""}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Classes</p>
              <p className="text-3xl font-bold mt-1">{school.classes.length}</p>
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Class averages</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                {school.classes.map((c) => (
                  <Bar key={c.classId} label={c.className} value={c.overallAverage} color={c.overallAverage >= 50 ? "bg-green-500" : "bg-red-400"} />
                ))}
                {school.classes.length === 0 && <p className="text-sm text-muted-foreground">No published results this term.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Subject comparison (school-wide)</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                {school.subjectComparison.map((s) => (
                  <Bar key={s.subjectName} label={s.subjectName} value={s.average} />
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Select filters and press Load.</CardContent></Card>
      )}
    </div>
  );
}

function Loader2Spinner() {
  return <span className="h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" />;
}
