"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Search, Printer, ScrollText, Loader2 } from "lucide-react";
import { gradeBadgeVariant, gradeColor } from "@/lib/exams/grades";

type TranscriptData = {
  student: {
    id: string; firstName: string; lastName: string; admissionNumber: string;
    gender: string | null; dateOfBirth: string | null; admissionStatus: string; graduatedAt: string | null;
  };
  schoolName: string;
  terms: {
    sessionName: string; termName: string; className: string; overallAverage: number;
    overallGrade: string | null; classPosition: number | null; promotionStatus: string; isPublished: boolean;
    subjects: { subjectName: string; total: number; grade: string | null; remark: string | null }[];
  }[];
  attendanceSummary: { present: number; total: number; rate: number };
  promotionHistory: { action: string; fromClass: string | null; toClass: string | null; session: string; note: string | null; date: string }[];
  graduation: { certificateNumber: string | null; session: string; date: string }[];
  generatedAt: string;
};

export default function TranscriptsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; firstName: string; lastName: string; admissionNumber: string; className: string | null }[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/students?search=${encodeURIComponent(query.trim())}`);
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.students ?? []);
      setSearched(true);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Search failed", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const open = async (studentId: string) => {
    setLoading(true);
    setTranscript(null);
    try {
      const res = await fetch(`/api/transcripts/${studentId}`);
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Transcript unavailable");
      setTranscript(data.transcript);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to load transcript", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Academic Transcripts</h2>
          <p className="text-sm text-muted-foreground">
            Complete academic history: every session, term, subject result, attendance summary, promotion and graduation record.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Search student</Label>
              <Input
                placeholder="Name or admission number…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
            </div>
            <Button onClick={search} disabled={searching || !query.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Search
            </Button>
          </div>

          {searched && (
            <div className="mt-4 space-y-1">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No students found.</p>
              ) : (
                results.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => open(s.id)}
                    className="w-full flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                  >
                    <span className="font-medium">{s.firstName} {s.lastName}</span>
                    <span className="text-xs text-muted-foreground font-mono">{s.admissionNumber} · {s.className ?? "—"}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {loading && <Card><CardContent className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</CardContent></Card>}

      {transcript && (
        <Card className="print:shadow-none">
          <CardHeader className="flex flex-row items-center justify-between print:hidden">
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-4 w-4" /> Transcript — {transcript.student.firstName} {transcript.student.lastName}
            </CardTitle>
            <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Header */}
            <div className="text-center border-b pb-4">
              <h3 className="text-lg font-bold">{transcript.schoolName}</h3>
              <p className="text-sm">ACADEMIC TRANSCRIPT</p>
              <p className="text-xs text-muted-foreground mt-1">
                {transcript.student.firstName} {transcript.student.lastName} · {transcript.student.admissionNumber}
                {transcript.student.gender ? ` · ${transcript.student.gender}` : ""}
                {transcript.student.dateOfBirth ? ` · Born ${new Date(transcript.student.dateOfBirth).toLocaleDateString()}` : ""}
              </p>
              <div className="flex justify-center gap-3 mt-2">
                <Badge variant="secondary">{transcript.student.admissionStatus}</Badge>
                <Badge variant="secondary">Attendance {transcript.attendanceSummary.rate.toFixed(0)}% ({transcript.attendanceSummary.present}/{transcript.attendanceSummary.total})</Badge>
                {transcript.graduation.length > 0 && (
                  <Badge variant="success">Graduated {transcript.graduation[0].certificateNumber ?? ""}</Badge>
                )}
              </div>
            </div>

            {/* Terms */}
            {transcript.terms.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No published terms on record yet.</p>
            )}
            {transcript.terms.map((t, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">
                    {t.sessionName} · Term {t.termName} · {t.className}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span>Average <b>{t.overallAverage.toFixed(2)}</b></span>
                    {t.overallGrade && <Badge variant={gradeBadgeVariant(t.overallGrade)} className={gradeColor(t.overallGrade)}>{t.overallGrade}</Badge>}
                    <span className="text-xs text-muted-foreground">{t.classPosition ? `${ordinal(t.classPosition)} in class` : ""}</span>
                    <Badge variant={t.promotionStatus === "PROMOTED" ? "success" : t.promotionStatus === "REPEATED" ? "destructive" : "secondary"}>
                      {t.promotionStatus}
                    </Badge>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Grade</TableHead>
                      <TableHead>Remark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {t.subjects.map((s, j) => (
                      <TableRow key={j}>
                        <TableCell className="text-sm">{s.subjectName}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{s.total.toFixed(1)}</TableCell>
                        <TableCell className="text-right">
                          {s.grade ? <Badge variant={gradeBadgeVariant(s.grade)} className={gradeColor(s.grade)}>{s.grade}</Badge> : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{s.remark ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    {t.subjects.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground">No subject results recorded.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            ))}

            {/* Promotion history */}
            {transcript.promotionHistory.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Promotion &amp; transfer history</p>
                <div className="space-y-1">
                  {transcript.promotionHistory.map((p, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      <b>{p.action}</b> {p.fromClass ?? "—"} → {p.toClass ?? "—"} · {p.session} · {new Date(p.date).toLocaleDateString()}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-right border-t pt-3">
              Generated {new Date(transcript.generatedAt).toLocaleString()} · EduFlow
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
