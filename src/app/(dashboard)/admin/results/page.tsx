"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCheck, Rocket, Lock, Undo2, FileText, RefreshCw } from "lucide-react";
import { gradeBadgeVariant, gradeColor } from "@/lib/exams/grades";

type SheetResult = {
  id: string;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
  caScore: string | null;
  examScore: string | null;
  total: string | null;
  percentage: string | null;
  grade: string | null;
  status: string;
  subjectPosition: number | null;
  totalStudents: number | null;
  approvals: { action: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string; actor: { name: string | null } }[];
};

type Approval = SheetResult["approvals"][number];

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  APPROVED: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  PUBLISHED: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  LOCKED: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};

const ACTION_LABEL: Record<string, string> = {
  SUBMIT: "Submit",
  APPROVE: "Approve",
  PUBLISH: "Publish",
  LOCK: "Lock",
  REJECT: "Reject",
};

type Session = { id: string; name: string; terms: { id: string; name: string }[] };

export default function ResultsApprovalPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<{ className: string; subjectName: string; sessionName: string; termName: string } | null>(null);
  const [results, setResults] = useState<SheetResult[]>([]);
  const [scores, setScores] = useState<{ id: string; studentId: string; assessmentType: { name: string } }[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/sessions").then((r) => parseJsonBody(r)),
      fetch("/api/admin/classes").then((r) => parseJsonBody(r)),
      fetch("/api/admin/subjects").then((r) => parseJsonBody(r)),
    ]).then(([s, c, su]) => {
      setSessions(s.sessions ?? []);
      setClasses(c.classes ?? []);
      setSubjects(su.subjects ?? []);
      if (s.sessions?.[0]) {
        setSessionId(s.sessions[0].id);
        setTermId(s.sessions[0].terms?.[0]?.id ?? "");
      }
    }).catch(() => {});
  }, []);

  const loadSheet = useCallback(async () => {
    if (!sessionId || !termId || !classId || !subjectId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ sessionId, termId, classId, subjectId });
      const res = await fetch(`/api/results/result-sheet?${params}`);
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setMeta(data.meta ?? null);
      setResults(data.results ?? []);
      setScores(data.scores ?? []);
      setSelected(new Set());
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to load sheet", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [sessionId, termId, classId, subjectId]);

  const runWorkflow = async (action: string) => {
    const ids = action === "SUBMIT" ? results.map((r) => r.id) : [...selected];
    if (ids.length === 0) {
      toast({ title: action === "SUBMIT" ? "No results to submit" : "Select results first", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/results/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultIds: ids, action }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Workflow action failed");
      toast({ title: `${ACTION_LABEL[action]}: ${data.moved} result(s) → ${data.toStatus}` });
      loadSheet();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Action failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const recalculate = async () => {
    if (!classId || !subjectId || !sessionId || !termId) return;
    setRecalculating(true);
    try {
      const res = await fetch("/api/scores/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, subjectId, sessionId, termId }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Recalculate failed");
      toast({ title: `Recomputed ${data.computed} result(s), ranked ${data.ranked} student(s)` });
      loadSheet();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Recalculate failed", variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  };

  const hasAny = (status: string) => results.some((r) => r.status === status);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Results &amp; Approval</h2>
          <p className="text-sm text-muted-foreground">
            Workflow: Draft → Submitted → Approved → Published → Locked. Publishing is blocked until every result in the sheet is approved.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
              <Label className="text-xs">Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={loadSheet} disabled={!sessionId || !termId || !classId || !subjectId || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                Load sheet
              </Button>
              <Button variant="outline" onClick={recalculate} disabled={recalculating || !classId || !subjectId} title="Recompute totals & positions from raw scores">
                <RefreshCw className={`h-4 w-4 ${recalculating ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {meta && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="text-sm px-3 py-1">{meta.className}</Badge>
          <Badge variant="secondary" className="text-sm px-3 py-1">{meta.subjectName}</Badge>
          <span className="text-sm text-muted-foreground">{meta.sessionName} · Term {meta.termName}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => runWorkflow("SUBMIT")} disabled={busy || results.length === 0 || !hasAny("DRAFT")}>
              <Send className="h-4 w-4 mr-1" /> Submit all drafts
            </Button>
            <Button size="sm" variant="outline" onClick={() => runWorkflow("APPROVE")} disabled={busy || selected.size === 0}>
              <CheckCheck className="h-4 w-4 mr-1" /> Approve ({selected.size})
            </Button>
            <Button size="sm" variant="outline" onClick={() => runWorkflow("PUBLISH")} disabled={busy || selected.size === 0}>
              <Rocket className="h-4 w-4 mr-1" /> Publish ({selected.size})
            </Button>
            <Button size="sm" variant="outline" onClick={() => runWorkflow("LOCK")} disabled={busy || selected.size === 0}>
              <Lock className="h-4 w-4 mr-1" /> Lock ({selected.size})
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => runWorkflow("REJECT")} disabled={busy || selected.size === 0}>
              <Undo2 className="h-4 w-4 mr-1" /> Reject ({selected.size})
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <Card><CardContent className="p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent></Card>
      ) : meta ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Result sheet · {results.length} student(s) · {scores.length} raw score(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={results.length > 0 && selected.size === results.length}
                      onCheckedChange={(v) => setSelected(v ? new Set(results.map((r) => r.id)) : new Set())}
                    />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                  <TableHead className="text-right">Exam</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Grade</TableHead>
                  <TableHead className="text-right">Pos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Audit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    No computed results yet — enter scores and press the recalculate button.
                  </TableCell></TableRow>
                )}
                {results.map((r) => (
                  <Fragment key={r.id}>
                    <TableRow>
                      <TableCell>
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                      </TableCell>
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
                      <TableCell className="text-right">{r.subjectPosition ? `${r.subjectPosition}${r.totalStudents ? `/${r.totalStudents}` : ""}` : "—"}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE[r.status] ?? ""}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.approvals.length > 0 && (
                          <button className="text-xs text-primary underline" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                            {r.approvals.length} event(s)
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                    {expanded === r.id && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/40">
                          <div className="space-y-1 py-1">
                            {r.approvals.map((a: Approval, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                <b>{ACTION_LABEL[a.action] ?? a.action}</b> {a.fromStatus ? `${a.fromStatus} → ` : ""}{a.toStatus}
                                {" · "}{a.actor.name ?? "unknown"}{" · "}{new Date(a.createdAt).toLocaleString()}
                                {a.note ? ` · “${a.note}”` : ""}
                              </p>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          Select a class, subject, session and term to view the result sheet.
        </CardContent></Card>
      )}
    </div>
  );
}
