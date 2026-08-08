"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, FileText, Sparkles, Eye } from "lucide-react";

type Session = { id: string; name: string; terms: { id: string; name: string }[] };
type ReportCardRow = {
  id: string;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
  session: { name: string };
  term: { name: string };
  class: { name: string };
  overallAverage: string;
  overallGrade: string | null;
  classPosition: number | null;
  promotionStatus: string;
  isPublished: boolean;
};

export default function ReportCardsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [cards, setCards] = useState<ReportCardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [commentCard, setCommentCard] = useState<ReportCardRow | null>(null);
  const [classComment, setClassComment] = useState("");
  const [principalComment, setPrincipalComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);

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
      const params = new URLSearchParams({ sessionId, termId });
      if (classId) params.set("classId", classId);
      const res = await fetch(`/api/report-cards?${params}`);
      const data = await res.json();
      setCards(data.reportCards ?? []);
    } finally {
      setLoading(false);
    }
  }, [sessionId, termId, classId]);

  const generate = async () => {
    if (!sessionId || !termId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/report-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, termId, classId: classId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      toast({ title: `Generated ${data.generated} report card(s)` });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Generation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const openComments = (card: ReportCardRow) => {
    setCommentCard(card);
    setClassComment("");
    setPrincipalComment("");
  };

  const saveComments = async () => {
    if (!commentCard) return;
    setSavingComment(true);
    try {
      const body: Record<string, unknown> = {};
      if (classComment) body.classTeacherComment = classComment;
      if (principalComment) body.principalComment = principalComment;
      const res = await fetch(`/api/report-cards/${commentCard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast({ title: "Comments saved" });
      setCommentCard(null);
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSavingComment(false);
    }
  };

  const togglePublish = async (card: ReportCardRow) => {
    try {
      const res = await fetch(`/api/report-cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !card.isPublished }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast({ title: card.isPublished ? "Report card unpublished" : "Report card published" });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Update failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Report Cards</h2>
          <p className="text-sm text-muted-foreground">
            Generate term report cards from published results. Cards include scores, grades, positions, attendance, comments and a QR verification code.
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
              <Label className="text-xs">Class (optional)</Label>
              <Select value={classId || "__all__"} onValueChange={(v) => setClassId(v === "__all__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All classes</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={load} disabled={!sessionId || !termId || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 mr-1" />}
                Load
              </Button>
              <Button onClick={generate} disabled={generating || !sessionId || !termId}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                {generating ? "Generating…" : "Generate"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{cards.length} report card(s)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="text-right">Grade</TableHead>
                  <TableHead className="text-right">Position</TableHead>
                  <TableHead>Promotion</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No report cards — pick a term and press Generate.
                  </TableCell></TableRow>
                )}
                {cards.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{c.student.firstName} {c.student.lastName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.student.admissionNumber}</p>
                    </TableCell>
                    <TableCell>{c.class.name}</TableCell>
                    <TableCell className="text-right font-bold">{Number(c.overallAverage).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{c.overallGrade ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.classPosition ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.promotionStatus === "PROMOTED" ? "success" : c.promotionStatus === "REPEATED" ? "destructive" : "secondary"}>
                        {c.promotionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.isPublished ? "success" : "secondary"}>{c.isPublished ? "Published" : "Draft"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openComments(c)}>Comments</Button>
                        <Button size="sm" variant={c.isPublished ? "outline" : "default"} onClick={() => togglePublish(c)}>
                          {c.isPublished ? "Unpublish" : "Publish"}
                        </Button>
                        <Button size="sm" asChild>
                          <Link href={`/report-cards/${c.id}`} target="_blank">
                            <FileText className="h-3.5 w-3.5 mr-1" /> View / Print
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!commentCard} onOpenChange={(o) => !o && setCommentCard(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Report card comments — {commentCard?.student.firstName} {commentCard?.student.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Class teacher comment</Label>
              <Textarea rows={3} value={classComment} onChange={(e) => setClassComment(e.target.value)} placeholder="Leave blank to keep existing comment" />
            </div>
            <div className="space-y-1.5">
              <Label>Principal comment</Label>
              <Textarea rows={3} value={principalComment} onChange={(e) => setPrincipalComment(e.target.value)} placeholder="Leave blank to keep existing comment" />
            </div>
            <Button className="w-full" onClick={saveComments} disabled={savingComment}>
              {savingComment && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save comments
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
