"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, User } from "lucide-react";
import { gradeBadgeVariant, gradeColor } from "@/lib/exams/grades";

type ChildCard = {
  id: string;
  sessionName: string;
  termName: string;
  overallAverage: number;
  overallGrade: string | null;
  classPosition: number | null;
  promotionStatus: string;
  isPublished: boolean;
};

type Child = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  className: string;
  reportCards: ChildCard[];
};

export default function ParentResultsPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/parent/results")
      .then((r) => parseJsonBody(r))
      .then((data) => setChildren(data.children ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Children&apos;s Results</h2>
        <p className="text-sm text-muted-foreground">Monitor results and download report cards. Read-only access.</p>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : children.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          No children linked to this parent account.
        </CardContent></Card>
      ) : (
        children.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> {c.firstName} {c.lastName}
                <span className="text-xs font-normal text-muted-foreground font-mono">{c.admissionNumber} · {c.className}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {c.reportCards.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No published report cards yet.</p>
              ) : (
                <div className="divide-y">
                  {c.reportCards.map((rc) => (
                    <div key={rc.id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-sm font-medium">{rc.sessionName} · Term {rc.termName}</p>
                        <p className="text-xs text-muted-foreground">
                          Average {rc.overallAverage.toFixed(2)}
                          {rc.classPosition ? ` · ${ordinal(rc.classPosition)} in class` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={gradeBadgeVariant(rc.overallGrade)} className={gradeColor(rc.overallGrade)}>{rc.overallGrade}</Badge>
                        <Badge variant={rc.promotionStatus === "PROMOTED" ? "success" : rc.promotionStatus === "REPEATED" ? "destructive" : "secondary"}>
                          {rc.promotionStatus}
                        </Badge>
                        <Button size="sm" variant="outline" asChild disabled={!rc.isPublished}>
                          <Link href={`/report-cards/${rc.id}`} target="_blank">
                            <FileText className="h-3.5 w-3.5 mr-1" /> Report card
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
