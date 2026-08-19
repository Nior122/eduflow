"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, User, TrendingUp, CalendarCheck2, DollarSign, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatCurrency } from "@/lib/utils";
import type { ChildSummary } from "@/hooks/use-children";

export default function ParentChildrenPage() {
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/parent/children")
      .then((r) => parseJsonBody(r))
      .then((d) => setChildren(d?.children ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>;
  }

  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <User className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No Child Linked</h3>
        <p className="text-muted-foreground">Please contact the school to link your child&apos;s profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> My Children
        </h2>
        <p className="text-muted-foreground">At-a-glance progress for every child under your care</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {children.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-primary/10 text-primary">{getInitials(`${c.firstName} ${c.lastName}`)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold truncate">{c.firstName} {c.lastName}</p>
                  <p className="text-sm text-muted-foreground">{c.className}</p>
                  <p className="text-xs text-muted-foreground">Adm: {c.admissionNumber}</p>
                </div>
                <Link href={`/parent/schoolwork`} className="shrink-0">
                  <Badge className="bg-primary/10 text-primary border-0 hover:bg-primary/20">
                    View <ArrowRight className="ml-1 h-3 w-3" />
                  </Badge>
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <TrendingUp className="mx-auto h-4 w-4 text-primary mb-1" />
                  <p className="text-lg font-bold">{c.averageScore}%</p>
                  <p className="text-[11px] text-muted-foreground">Avg Score</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <CalendarCheck2 className="mx-auto h-4 w-4 text-primary mb-1" />
                  <p className="text-lg font-bold">{c.attendanceRate}%</p>
                  <p className="text-[11px] text-muted-foreground">Attendance</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <DollarSign className="mx-auto h-4 w-4 text-primary mb-1" />
                  <p className="text-lg font-bold">{formatCurrency(c.feeBalance)}</p>
                  <p className="text-[11px] text-muted-foreground">Balance</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Link href={`/parent/attendance`} className="text-primary hover:underline">Attendance</Link>
                <span className="text-muted-foreground">·</span>
                <Link href={`/parent/timetable`} className="text-primary hover:underline">Timetable</Link>
                <span className="text-muted-foreground">·</span>
                <Link href={`/parent/results`} className="text-primary hover:underline">Results</Link>
                <span className="text-muted-foreground">·</span>
                <Link href={`/parent/fees`} className="text-primary hover:underline">Fees</Link>
                <span className="text-muted-foreground">·</span>
                <Link href={`/parent/report-cards`} className="text-primary hover:underline">Report Cards</Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
