"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  DollarSign,
  UserPlus,
  Wallet,
  ArrowUpRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

type DashboardData = {
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalParents: number;
    totalClasses: number;
    attendanceRate: number;
    feeCollection: number;
    performanceAvg: number;
    revenue: number;
    outstanding: number;
    studentTrend: number | null;
    teacherTrend: number | null;
  };
  recentActivities: Array<{
    id: string;
    title: string;
    description: string;
    time: string;
    type: string;
  }>;
  recentAdmissions: Array<{
    id: string;
    name: string;
    admissionNumber: string;
    createdAt: string;
  }>;
  feeTotal: number;
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/dashboard");
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error("Failed to load dashboard", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome back!</h2>
        <p className="text-muted-foreground">Here&apos;s what&apos;s happening at your school today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          title="Total Students"
          value={stats?.totalStudents ?? 0}
          icon={Users}
          trend={stats?.studentTrend ?? undefined}
          description="vs last month"
        />
        <StatCard
          title="Total Teachers"
          value={stats?.totalTeachers ?? 0}
          icon={GraduationCap}
          trend={stats?.teacherTrend ?? undefined}
          description="vs last month"
        />
        <StatCard
          title="Parents"
          value={stats?.totalParents ?? 0}
          icon={UserPlus}
          description="linked accounts"
        />
        <StatCard
          title="Classes"
          value={stats?.totalClasses ?? 0}
          icon={BookOpen}
          description="active classes"
        />
        <StatCard
          title="Attendance Rate"
          value={stats ? `${stats.attendanceRate}%` : "0%"}
          icon={ClipboardCheck}
          description="last 100 records"
        />
        <StatCard
          title="Fee Collection"
          value={stats ? `${stats.feeCollection}%` : "0%"}
          icon={DollarSign}
          description="this term"
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(stats?.revenue ?? 0)}
          icon={Wallet}
          description="paid & waived"
        />
        <StatCard
          title="Outstanding Fees"
          value={formatCurrency(stats?.outstanding ?? 0)}
          icon={AlertCircle}
          description="pending & partial"
        />
      </div>

      {/* Performance, Activity & Recent Admissions */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Academic Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary mb-2">
                  {stats?.performanceAvg ?? "—"}
                </div>
                <p className="text-sm text-muted-foreground">Overall Performance Score</p>
                <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span>A: Excellent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span>B: Good</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span>C: Needs Work</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data?.recentActivities ?? []).length > 0 ? (
                data?.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Recent Admissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.recentAdmissions ?? []).length > 0 ? (
                data?.recentAdmissions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{s.admissionNumber}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No recent admissions</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
