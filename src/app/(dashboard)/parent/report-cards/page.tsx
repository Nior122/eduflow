"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, TrendingUp, ScrollText, BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildSelect } from "@/components/portal/child-select";
import { useChildren } from "@/hooks/use-children";
import { formatDate } from "@/lib/utils";

type ReportCardData = {
  child: { firstName: string; lastName: string; className: string | null };
  reportCards: {
    id: string;
    sessionName: string;
    termName: string;
    className: string;
    overallAverage: number;
    overallGrade: string | null;
    classPosition: number | null;
    totalStudents: number | null;
    promotionStatus: string;
    classTeacherComment: string | null;
    principalComment: string | null;
    verificationCode: string;
    publishedAt: string | null;
  }[];
  transcript: { lastGeneratedAt: string } | null;
};

export default function ParentReportCardsPage() {
  const { children, selectedId, setSelectedId, loading } = useChildren();
  const [data, setData] = useState<ReportCardData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const load = useCallback(async (childId: string) => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/parent/${childId}/report-card`);
      const d = await parseJsonBody(res);
      if (res.ok) setData(d);
    } catch {
      /* ignore */
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) load(selectedId);
  }, [selectedId, load]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" /> Report Cards
          </h2>
          <p className="text-muted-foreground">Published report cards for the selected child</p>
        </div>
        <ChildSelect children={children} selectedId={selectedId} onSelect={setSelectedId} loading={loading} />
      </div>

      {dataLoading ? (
        <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : !data ? (
        <p className="text-muted-foreground">No report card data available.</p>
      ) : (
        <>
          {data.transcript && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              <ScrollText className="h-4 w-4 text-primary" />
              <span>Academic transcript generated {formatDate(data.transcript.lastGeneratedAt)}.</span>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {data.reportCards.length === 0 ? (
              <Card className="md:col-span-2">
                <CardContent className="py-16 text-center">
                  <BadgeCheck className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="font-semibold">No published report cards yet</p>
                  <p className="text-sm text-muted-foreground">Report cards appear here once the school publishes them.</p>
                </CardContent>
              </Card>
            ) : (
              data.reportCards.map((rc) => (
                <Card key={rc.id} className="border-primary/20">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-lg font-bold">{rc.sessionName} — {rc.termName} Term</p>
                        <p className="text-sm text-muted-foreground">{rc.className}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-primary">{rc.overallAverage}%</p>
                        <Badge className="bg-primary/10 text-primary">{rc.overallGrade ?? "—"}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Position <span className="font-bold">{rc.classPosition ?? "—"}</span>
                        {rc.totalStudents ? ` of ${rc.totalStudents}` : ""}
                      </span>
                    </div>
                    {rc.classTeacherComment && (
                      <div className="rounded-lg bg-muted/50 p-3 text-sm">
                        <span className="font-medium">Class teacher: </span>{rc.classTeacherComment}
                      </div>
                    )}
                    {rc.principalComment && (
                      <div className="rounded-lg bg-muted/50 p-3 text-sm">
                        <span className="font-medium">Principal: </span>{rc.principalComment}
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                      <span>Verification: <span className="font-mono">{rc.verificationCode.slice(0, 10)}…</span></span>
                      <span>{rc.publishedAt ? `Published ${formatDate(rc.publishedAt)}` : ""}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
