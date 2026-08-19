"use client";

import { useEffect, useState } from "react";
import { ScrollText, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

type TranscriptData = {
  transcript: { lastGeneratedAt: string } | null;
  blocks: {
    sessionName: string;
    termName: string;
    average: number;
    subjectsCount: number;
    rows: { subject: string; total: number; grade: string | null }[];
  }[];
};

export default function StudentTranscriptPage() {
  const [data, setData] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/transcript")
      .then((r) => parseJsonBody(r))
      .then((d) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>;
  }

  const blocks = data?.blocks ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" /> Academic Transcript
        </h2>
        <p className="text-muted-foreground">Your published results, session by session</p>
      </div>

      {data?.transcript && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <GraduationCap className="h-4 w-4 text-primary" />
          <span>Official transcript generated {formatDate(data.transcript.lastGeneratedAt)}. Contact the school for certified copies.</span>
        </div>
      )}

      {blocks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ScrollText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-semibold">No published results yet</p>
            <p className="text-sm text-muted-foreground">Your transcript builds automatically from published results.</p>
          </CardContent>
        </Card>
      ) : (
        blocks.map((b) => (
          <Card key={`${b.sessionName}-${b.termName}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{b.sessionName} — {b.termName} Term</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary">{b.average}% average</Badge>
                  <Badge variant="secondary">{b.subjectsCount} subjects</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {b.rows.map((r) => (
                    <TableRow key={`${b.sessionName}-${r.subject}`}>
                      <TableCell className="font-medium">{r.subject}</TableCell>
                      <TableCell className="text-right">{r.total}%</TableCell>
                      <TableCell className="text-right"><Badge variant="secondary">{r.grade ?? "—"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
