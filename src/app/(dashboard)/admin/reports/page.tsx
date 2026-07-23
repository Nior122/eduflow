"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Users, DollarSign, GraduationCap, Award } from "lucide-react";

type ReportData = {
  academic: { bestStudents: number; weakSubjects: number; classAverages: number };
  financial: { revenue: number; outstanding: number };
  attendance: { rate: number; trend: number };
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/reports")
      .then(r => r.ok && r.json())
      .then(d => setData(d))
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
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Award className="h-4 w-4" /> Top Performers</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : data?.academic.bestStudents || 0}</p><p className="text-xs text-muted-foreground">Students with A average</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Weak Areas</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : data?.academic.weakSubjects || 0}</p><p className="text-xs text-muted-foreground">Subjects needing improvement</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Class Average</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : `${data?.academic.classAverages || 0}%`}</p><p className="text-xs text-muted-foreground">Overall performance</p></CardContent></Card>
          </div>
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Detailed academic charts and class performance breakdowns will appear here when data is available.</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" /> Total Revenue</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-24" /> : `₦${(data?.financial?.revenue || 0).toLocaleString()}`}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" /> Outstanding Fees</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-24" /> : `₦${(data?.financial?.outstanding || 0).toLocaleString()}`}</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Overall Attendance</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : `${data?.attendance?.rate || 0}%`}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Trend</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : `${data?.attendance?.trend || 0}%`}</p></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
