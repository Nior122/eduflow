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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, RefreshCw, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { gradeBadgeVariant, gradeColor } from "@/lib/exams/grades";

type MyClass = { classId: string; className: string; subjectId: string; subjectName: string };
type Session = { id: string; name: string; terms: { id: string; name: string }[] };
type AssessmentType = { assessmentTypeId: string; name: string; code: string | null; kind: "CA" | "EXAM"; weight: number; maxScore: number };
type StudentRow = { id: string; firstName: string; lastName: string; admissionNumber: string; gender: string | null };
type ResultRow = {
  id: string; studentId: string; total: string | null; percentage: string | null;
  caScore: string | null; examScore: string | null; grade: string | null; status: string;
  subjectPosition: number | null;
};
type SavedScore = { id: string; studentId: string; assessmentTypeId: string; score: string; maxScore: number };

// Client-side preview of the weighted total (mirrors the server engine).
function previewTotal(
  studentId: string,
  types: AssessmentType[],
  scores: Record<string, Record<string, string>>
): number | null {
  let total = 0;
  let hasAny = false;
  for (const t of types) {
    const raw = scores[studentId]?.[t.assessmentTypeId];
    if (raw === undefined || raw === "") continue;
    const num = Number(raw);
    if (Number.isNaN(num)) continue;
    hasAny = true;
    total += (num / Math.max(t.maxScore, 1)) * t.weight;
  }
  return hasAny ? Math.round(total * 100) / 100 : null;
}

export default function TeacherScoresPage() {
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [pairKey, setPairKey] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [types, setTypes] = useState<AssessmentType[]>([]);
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});
  const [saved, setSaved] = useState<Record<string, SavedScore>>({});
  const [results, setResults] = useState<Record<string, ResultRow>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/teacher/my-classes").then((r) => r.json()),
      fetch("/api/admin/sessions").then((r) => r.json()),
    ]).then(([c, s]) => {
      setMyClasses(c.classes ?? []);
      setSessions(s.sessions ?? []);
      if (s.sessions?.[0]) {
        setSessionId(s.sessions[0].id);
        setTermId(s.sessions[0].terms?.[0]?.id ?? "");
      }
    }).catch(() => {});
  }, []);

  const loadGrid = useCallback(async () => {
    if (!sessionId || !termId || !pairKey) return;
    const [classId, subjectId] = pairKey.split("|");
    setLoading(true);
    try {
      const params = new URLSearchParams({ classId, subjectId, sessionId, termId });
      const res = await fetch(`/api/scores?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");

      setStudents(data.students ?? []);
      setTypes(data.assessmentTypes ?? []);

      const map: Record<string, Record<string, string>> = {};
      for (const s of data.scores ?? []) {
        map[s.studentId] = { ...(map[s.studentId] ?? {}), [s.assessmentTypeId]: String(s.score) };
      }
      setScores(map);

      const savedMap: Record<string, SavedScore> = {};
      for (const s of data.scores ?? []) savedMap[`${s.studentId}:${s.assessmentTypeId}`] = s;
      setSaved(savedMap);

      const resMap: Record<string, ResultRow> = {};
      for (const r of data.results ?? []) resMap[r.studentId] = r;
      setResults(resMap);
      setDirty(false);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [sessionId, termId, pairKey]);

  const setScore = (studentId: string, typeId: string, value: string) => {
    setScores((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] ?? {}), [typeId]: value } }));
    setDirty(true);
  };

  const saveAll = async () => {
    if (!pairKey || !sessionId || !termId) return;
    const [classId, subjectId] = pairKey.split("|");
    const rows: { studentId: string; assessmentTypeId: string; score: number }[] = [];
    for (const student of students) {
      for (const t of types) {
        const raw = scores[student.id]?.[t.assessmentTypeId];
        if (raw === undefined || raw === "") continue;
        const num = Number(raw);
        if (Number.isNaN(num)) continue;
        rows.push({ studentId: student.id, assessmentTypeId: t.assessmentTypeId, score: num });
      }
    }
    if (rows.length === 0) {
      toast({ title: "No scores to save", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, subjectId, sessionId, termId, rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.errors?.length) {
        toast({ title: `Saved ${data.saved} score(s) with ${data.errors.length} rejection(s)`, variant: "destructive" });
      } else {
        toast({ title: `Saved ${data.saved} score(s)` });
      }
      setDirty(false);
      loadGrid();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const recalculate = async () => {
    if (!pairKey || !sessionId || !termId) return;
    const [classId, subjectId] = pairKey.split("|");
    setRecalculating(true);
    try {
      const res = await fetch("/api/scores/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, subjectId, sessionId, termId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Recalculate failed");
      toast({
        title: `Computed ${data.computed} result(s)${data.missingScores ? `, ${data.missingScores} student(s) without scores skipped` : ""}`,
      });
      loadGrid();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Recalculate failed", variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Score Entry</h2>
          <p className="text-sm text-muted-foreground">
            Spreadsheet-style entry for your assigned classes. Totals are auto-computed with the configured weights (e.g. Assignment 10% + Test 20% + Project 10% + Exam 60%).
          </p>
        </div>
        {dirty && <Badge className="bg-amber-500">Unsaved changes</Badge>}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Session</Label>
              <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setTermId(sessions.find((s) => s.id === v)?.terms?.[0]?.id ?? ""); }}>
                <SelectTrigger><SelectValue placeholder="Session" /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Term</Label>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger><SelectValue placeholder="Term" /></SelectTrigger>
                <SelectContent>
                  {sessions.find((s) => s.id === sessionId)?.terms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>Term {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Class / Subject</Label>
              <Select value={pairKey} onValueChange={setPairKey}>
                <SelectTrigger><SelectValue placeholder="Your classes" /></SelectTrigger>
                <SelectContent>
                  {myClasses.map((c) => (
                    <SelectItem key={`${c.classId}|${c.subjectId}`} value={`${c.classId}|${c.subjectId}`}>
                      {c.className} — {c.subjectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={loadGrid} disabled={!pairKey || !sessionId || !termId || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
                Load grid
              </Button>
              <Button variant="outline" onClick={recalculate} disabled={recalculating || !pairKey} title="Recompute totals, grades and positions from saved scores">
                <RefreshCw className={`h-4 w-4 ${recalculating ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {students.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {students.length} student(s) × {types.length} component(s)
              <span className="ml-3 text-xs font-normal text-muted-foreground">
                {types.map((t) => `${t.name} ${t.weight}%`).join(" · ")}
              </span>
            </CardTitle>
            <Button onClick={saveAll} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {saving ? "Saving…" : "Save all scores"}
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background min-w-[180px]">Student</TableHead>
                  {types.map((t) => (
                    <TableHead key={t.assessmentTypeId} className="text-center min-w-[110px]">
                      <p className="text-xs">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground font-normal">/{t.maxScore} · {t.weight}%</p>
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[90px]">Total</TableHead>
                  <TableHead className="text-center min-w-[80px]">Grade</TableHead>
                  <TableHead className="text-center min-w-[90px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => {
                  const total = previewTotal(s.id, types, scores);
                  const result = results[s.id];
                  const grade = result?.grade ?? (total !== null ? null : null);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="sticky left-0 bg-background">
                        <p className="font-medium text-sm">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.admissionNumber}</p>
                      </TableCell>
                      {types.map((t) => {
                        const key = `${s.id}:${t.assessmentTypeId}`;
                        const savedScore = saved[key];
                        const local = scores[s.id]?.[t.assessmentTypeId];
                        const value = local ?? "";
                        const invalid = value !== "" && (Number(value) < 0 || Number(value) > t.maxScore);
                        return (
                          <TableCell key={t.assessmentTypeId} className="text-center">
                            <Input
                              type="number"
                              step="0.1"
                              min={0}
                              max={t.maxScore}
                              className={`h-9 w-20 mx-auto text-sm ${invalid ? "border-red-500 text-red-600" : ""}`}
                              placeholder={savedScore ? String(savedScore.score) : "—"}
                              value={value}
                              onChange={(e) => setScore(s.id, t.assessmentTypeId, e.target.value)}
                            />
                            {invalid && <p className="text-[10px] text-red-500">max {t.maxScore}</p>}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold text-lg">
                        {result?.percentage ?? (total !== null ? total : "—")}
                      </TableCell>
                      <TableCell className="text-center">
                        {result?.grade ? <Badge variant={gradeBadgeVariant(result.grade)} className={gradeColor(result.grade)}>{result.grade}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {result ? (
                          <Badge variant={result.status === "DRAFT" ? "secondary" : "success"}>{result.status}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">no result</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
          <CardContent className="pt-4 pb-4 flex items-center gap-2 text-xs text-muted-foreground border-t">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            Scores validate on save (no negatives, no above-max, duplicates prevented). After saving, press the recalculate button to refresh totals, grades and positions.
          </CardContent>
        </Card>
      )}

      {!loading && students.length === 0 && pairKey && (
        <Card><CardContent className="p-10 flex flex-col items-center gap-3 text-muted-foreground">
          <AlertCircle className="h-8 w-8" />
          <p>No grid loaded. Pick a class/subject and press “Load grid”.</p>
        </CardContent></Card>
      )}
    </div>
  );
}
