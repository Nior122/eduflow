"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, GraduationCap, Repeat, Archive, ArrowRightLeft } from "lucide-react";

type Session = { id: string; name: string; terms: { id: string; name: string }[] };

type Candidate = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  average: number;
  passedSubjects: number;
  failedSubjects: number;
  subjectsTaken: number;
  suggestedAction: "PROMOTED" | "REPEATED";
  suggestedClassId: string | null;
  suggestedClassName: string | null;
};

type HistoryRow = {
  id: string;
  action: string;
  note: string | null;
  createdAt: string;
  student: { firstName: string; lastName: string; admissionNumber: string };
  fromClass: { name: string } | null;
  toClass: { name: string } | null;
};

type PromotionActionType = "PROMOTED" | "REPEATED" | "GRADUATED" | "TRANSFERRED" | "ARCHIVED";

type ActionDialog = {
  student: Candidate;
  action: PromotionActionType;
} | null;

export default function PromotionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [dialog, setDialog] = useState<ActionDialog>(null);
  const [targetClass, setTargetClass] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/sessions").then((r) => parseJsonBody(r)),
      fetch("/api/admin/classes").then((r) => parseJsonBody(r)),
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
    if (!sessionId || !termId || !classId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ sessionId, termId, classId });
      const res = await fetch(`/api/promotions?${params}`);
      const data = await parseJsonBody(res);
      setCandidates(data.candidates ?? []);
      setHistory(data.history ?? []);
    } finally {
      setLoading(false);
    }
  }, [sessionId, termId, classId]);

  const openAction = (student: Candidate, action: PromotionActionType) => {
    setDialog({ student, action });
    setTargetClass(student.suggestedClassId ?? "");
    setNote("");
  };

  const apply = async () => {
    if (!dialog) return;
    const { student, action } = dialog;
    if ((action === "PROMOTED" || action === "TRANSFERRED") && !targetClass) {
      toast({ title: "Select a target class", variant: "destructive" });
      return;
    }
    setApplying(true);
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.studentId,
          action,
          fromClassId: classId,
          toClassId: targetClass || null,
          sessionId,
          note,
        }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Action failed");
      toast({ title: `${student.studentName} → ${action}` });
      setDialog(null);
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Action failed", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Promotion &amp; Graduation</h2>
          <p className="text-sm text-muted-foreground">
            Suggestion engine: promoted when average ≥ 50 with no failing subject; otherwise repeated. Apply actions per student.
          </p>
        </div>
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
              <Label className="text-xs">Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={load} disabled={!sessionId || !termId || !classId || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-1" />}
                Load candidates
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Candidates · {candidates.length}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="text-right">Passed</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead>Suggestion</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No published results for this class/term yet.
                  </TableCell></TableRow>
                )}
                {candidates.map((c) => (
                  <TableRow key={c.studentId}>
                    <TableCell>
                      <p className="font-medium text-sm">{c.studentName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.admissionNumber}</p>
                    </TableCell>
                    <TableCell className="text-right font-bold">{c.average.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-green-600">{c.passedSubjects}</TableCell>
                    <TableCell className="text-right text-red-600">{c.failedSubjects}</TableCell>
                    <TableCell>
                      <Badge variant={c.suggestedAction === "PROMOTED" ? "success" : "destructive"}>
                        {c.suggestedAction}
                        {c.suggestedClassName ? ` → ${c.suggestedClassName}` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openAction(c, "PROMOTED")}>
                          <GraduationCap className="h-3.5 w-3.5" /> Promote
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openAction(c, "REPEATED")}>
                          <Repeat className="h-3.5 w-3.5" /> Repeat
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openAction(c, "TRANSFERRED")}>
                          <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openAction(c, "GRADUATED")}>
                          🎓 Graduate
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => openAction(c, "ARCHIVED")}>
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recent actions (this session)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>From → To</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm">{h.student.firstName} {h.student.lastName}</TableCell>
                    <TableCell><Badge variant="secondary">{h.action}</Badge></TableCell>
                    <TableCell className="text-sm">{h.fromClass?.name ?? "—"} → {h.toClass?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{h.note ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(h.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.action} — {dialog?.student.studentName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(dialog?.action === "PROMOTED" || dialog?.action === "TRANSFERRED") && (
              <div className="space-y-1.5">
                <Label>Target class</Label>
                <Select value={targetClass} onValueChange={setTargetClass}>
                  <SelectTrigger><SelectValue placeholder="Select target class" /></SelectTrigger>
                  <SelectContent>
                    {classes.filter((c) => c.id !== classId).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / remark" />
            </div>
            <Button className="w-full" onClick={apply} disabled={applying}>
              {applying && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirm {dialog?.action}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
