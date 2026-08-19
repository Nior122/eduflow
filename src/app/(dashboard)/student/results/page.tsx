"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileText, BookOpen } from "lucide-react";
import { gradeBadgeVariant, gradeColor } from "@/lib/exams/grades";

type CardRow = {
  id: string;
  sessionName: string;
  termName: string;
  className: string;
  overallAverage: number;
  overallGrade: string | null;
  classPosition: number | null;
  promotionStatus: string;
  isPublished: boolean;
  verificationCode: string;
};

type TermResults = {
  sessionId: string;
  termId: string;
  rows: { subjectName: string; caScore: number; examScore: number; total: number; grade: string | null; remark: string | null; subjectPosition: number | null; totalStudents: number | null }[];
};

export default function StudentResultsPage() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [terms, setTerms] = useState<TermResults[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/results")
      .then((r) => parseJsonBody(r))
      .then((data) => {
        setCards(data.reportCards ?? []);
        setTerms(data.resultsByTerm ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Results</h2>
        <p className="text-sm text-muted-foreground">Published results and report cards. Results are read-only.</p>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : cards.length === 0 && terms.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          No results published yet — check back after your school publishes the term results.
        </CardContent></Card>
      ) : (
        <>
          {cards.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((c) => (
                <Card key={c.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{c.sessionName} · Term {c.termName} · {c.className}</p>
                        <p className="text-2xl font-bold mt-1">{c.overallAverage.toFixed(2)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={gradeBadgeVariant(c.overallGrade)} className={gradeColor(c.overallGrade)}>{c.overallGrade}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {c.classPosition ? `${ordinal(c.classPosition)} in class` : ""}
                          </span>
                        </div>
                      </div>
                      <Badge variant={c.promotionStatus === "PROMOTED" ? "success" : c.promotionStatus === "REPEATED" ? "destructive" : "secondary"}>
                        {c.promotionStatus}
                      </Badge>
                    </div>
                    <Button size="sm" className="w-full mt-4" asChild disabled={!c.isPublished}>
                      <Link href={`/report-cards/${c.id}`} target="_blank">
                        <FileText className="h-4 w-4 mr-1" />
                        {c.isPublished ? "View / download report card" : "Awaiting publication"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {terms.map((t) => (
            <Card key={`${t.sessionId}:${t.termId}`}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Subject results
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">CA</TableHead>
                      <TableHead className="text-right">Exam</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Grade</TableHead>
                      <TableHead className="text-right">Position</TableHead>
                      <TableHead>Remark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {t.rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.subjectName}</TableCell>
                        <TableCell className="text-right">{r.caScore.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{r.examScore.toFixed(1)}</TableCell>
                        <TableCell className="text-right font-bold">{r.total.toFixed(1)}</TableCell>
                        <TableCell className="text-right">
                          {r.grade ? <Badge variant={gradeBadgeVariant(r.grade)} className={gradeColor(r.grade)}>{r.grade}</Badge> : "—"}
                        </TableCell>
                        <TableCell className="text-right">{r.subjectPosition ? `${r.subjectPosition}/${r.totalStudents}` : "—"}</TableCell>
                        <TableCell className="text-xs">{r.remark ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
