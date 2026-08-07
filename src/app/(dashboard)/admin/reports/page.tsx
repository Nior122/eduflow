"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, DollarSign, GraduationCap, Award, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type BestStudent = { name: string; score: number; grade: string };
type WeakSubject = { name: string; avg: number; results: number };

type ReportData = {
  academic: {
    bestStudents: BestStudent[];
    weakSubjects: WeakSubject[];
    classAverages: number;
  };
  financial: { revenue: number; outstanding: number; totalFees: number };
  attendance: { rate: number; trend: number | null };
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/reports")
      .then((r) => r.ok && r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
        <p className="text-muted-foreground">Comprehensive insights into school performance</p>
      </div>

      <Tabs defaultValue="academic">
        <TabsList>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="academic" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Award className="h-4 w-4" /> Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : data?.academic.bestStudents.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Students in the top 5</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Weak Areas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : data?.academic.weakSubjects.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Subjects averaging below 50%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Class Average</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : `${data?.academic.classAverages ?? 0}%`}</p>
                <p className="text-xs text-muted-foreground">Overall performance</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Top 5 students</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (data?.academic.bestStudents ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No results recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {data!.academic.bestStudents.map((s, i) => (
                      <div key={`${s.name}-${i}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>
                          {s.name}
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge variant="success">{s.grade}</Badge>
                          <span className="font-medium">{s.score}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Subjects needing improvement</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (data?.academic.weakSubjects ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No weak subjects — every subject averages 50% or above
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data!.academic.weakSubjects.map((s) => (
                      <div key={s.name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span>{s.name}</span>
                        <span className="flex items-center gap-2">
                          <Badge variant="destructive">{s.avg}%</Badge>
                          <span className="text-xs text-muted-foreground">{s.results} results</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" /> Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-24" /> : formatCurrency(data?.financial.revenue ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Paid & waived fee records</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" /> Outstanding Fees</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-24" /> : formatCurrency(data?.financial.outstanding ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Pending & partial balances</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" /> Total Fees</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-24" /> : formatCurrency(data?.financial.totalFees ?? 0)}</p>
                <p className="text-xs text-muted-foreground">All active fee types</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Overall Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : `${data?.attendance.rate ?? 0}%`}</p>
                <p className="text-xs text-muted-foreground">Present vs all records</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {loading ? <Skeleton className="h-8 w-16" /> : data?.attendance.trend == null ? "—" : `${data.attendance.trend > 0 ? "+" : ""}${data.attendance.trend}%`}
                </p>
                <p className="text-xs text-muted-foreground">Recent vs earlier period</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
