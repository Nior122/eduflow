"use client";

import { useEffect, useState } from "react";
import { Award, TrendingUp, BadgeCheck, ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

type ReportCardData = {
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
};

export default function StudentReportCardPage() {
  const [data, setData] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/report-card")
      .then((r) => r.json())
      .then((d) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>;
  }

  const cards = data?.reportCards ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" /> My Report Cards
        </h2>
        <p className="text-muted-foreground">Published report cards with teacher feedback</p>
      </div>

      {cards.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BadgeCheck className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-semibold">No published report cards yet</p>
            <p className="text-sm text-muted-foreground">Your report card will appear here once the school publishes it.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((rc) => (
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
                  <span className="flex items-center gap-1"><ScrollText className="h-3 w-3" /> {rc.verificationCode.slice(0, 10)}…</span>
                  <span>{rc.publishedAt ? `Published ${formatDate(rc.publishedAt)}` : ""}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
