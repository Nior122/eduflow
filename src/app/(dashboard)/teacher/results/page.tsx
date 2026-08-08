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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, FileSpreadsheet } from "lucide-react";
import { gradeBadgeVariant, gradeColor } from "@/lib/exams/grades";

type MyClass = { classId: string; className: string; subjectId: string; subjectName: string };
type Session = { id: string; name: string; terms: { id: string; name: string }[] };

type Row = {
  id: string;
  student: { firstName: string; lastName: string; admissionNumber: string };
  caScore: string | null;
  examScore: string | null;
  percentage: string | null;
  grade: string | null;
  status: string;
  subjectPosition: number | null;
  totalStudents: number | null;
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  APPROVED: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  PUBLISHED: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  LOCKED: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};

export default function TeacherResultsPage() {
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [pairKey, setPairKey] = useState("");
  const [meta, setMeta] = useState<{ className: string; subjectName: string; sessionName: string; termName: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const load = useCallback(async () => {
    if (!sessionId || !termId || !pairKey) return;
    const [classId, subjectId] = pairKey.split("|");
    setLoading(true);
    try {
      const params = new URLSearchParams({ classId, subjectId, sessionId, termId });
      const res = await fetch(`/api/results/result-sheet?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setMeta(data.meta ?? null);
      setRows(data.results ?? []);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [sessionId, termId, pairKey]);

  const submitAll = async () => {
    const draftIds = rows.filter((r) => r.status === "DRAFT").map((r) => r.id);
    if (draftIds.length === 0) {
      toast({ title: "No draft results to submit" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/results/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultIds: draftIds, action: "SUBMIT" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      toast({ title: `Submitted ${data.moved} result(s) for approval` });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Submit failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Results</h2>
          <p className="text-sm text-muted-foreground">
            Computed results for your classes. Submit drafts — the administrator approves and publishes them.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
              <Label className="text-xs">Class / Subject</Label>
              <Select value={pairKey} onValueChange={setPairKey}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Button onClick={load} disabled={!pairKey || !sessionId || !termId || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
                Load
              </Button>
              <Button variant="outline" onClick={submitAll} disabled={submitting || rows.length === 0}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Submit all drafts
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {meta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {meta.className} · {meta.subjectName} · {meta.sessionName} Term {meta.termName} — {rows.length} result(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                  <TableHead className="text-right">Exam</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Grade</TableHead>
                  <TableHead className="text-right">Position</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No computed results — enter scores in Score Entry and recalculate.
                  </TableCell></TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{r.student.firstName} {r.student.lastName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.student.admissionNumber}</p>
                    </TableCell>
                    <TableCell className="text-right">{r.caScore ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.examScore ?? "—"}</TableCell>
                    <TableCell className="text-right font-bold">{r.percentage ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {r.grade ? <Badge variant={gradeBadgeVariant(r.grade)} className={gradeColor(r.grade)}>{r.grade}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-right">{r.subjectPosition ? `${r.subjectPosition}/${r.totalStudents}` : "—"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE[r.status] ?? ""}>{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!meta && !loading && (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          Select a class, subject, session and term.
        </CardContent></Card>
      )}
    </div>
  );
}
