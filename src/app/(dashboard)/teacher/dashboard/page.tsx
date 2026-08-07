"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, BookOpen, ClipboardCheck, Brain, FileSpreadsheet, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TeacherDashboardPage() {
  const [stats, setStats] = useState({ students: 0, classes: 0, subjects: 0, attendanceToday: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/dashboard")
      .then((r) => r.ok && r.json())
      .then((d) => d && setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const quickActions = [
    { label: "Take Attendance", icon: ClipboardCheck, href: "/teacher/attendance", color: "text-blue-500" },
    { label: "Enter Results", icon: FileSpreadsheet, href: "/teacher/results", color: "text-green-500" },
    { label: "Generate Lesson Plan", icon: Brain, href: "/teacher/lesson-plans", color: "text-purple-500" },
    { label: "AI Report Comment", icon: Sparkles, href: "/teacher/report-comments", color: "text-amber-500" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Teacher Dashboard</h2>
        <p className="text-muted-foreground">Welcome back! Manage your classes and teaching tasks.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : (
          <>
            <StatCard title="My Students" value={stats.students} icon={Users} />
            <StatCard title="Classes" value={stats.classes} icon={BookOpen} />
            <StatCard title="Subjects" value={stats.subjects} icon={BookOpen} />
            <StatCard title="Today's Attendance" value={`${stats.attendanceToday}%`} icon={ClipboardCheck} />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href}>
                  <div className="flex flex-col items-center gap-2 rounded-xl border p-4 hover:bg-accent transition-colors cursor-pointer">
                    <Icon className={`h-8 w-8 ${action.color}`} />
                    <span className="text-sm font-medium text-center">{action.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI Features Promo */}
      <Card className="gradient-card border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold">AI Teaching Assistant</h3>
              </div>
              <p className="text-sm text-muted-foreground max-w-lg">
                Save hours of work — generate report comments, lesson plans, and analyze student performance with AI.
              </p>
              <div className="flex gap-3 pt-2">
                <Link href="/teacher/lesson-plans"><Button size="sm" variant="gradient">Generate Lesson Plan</Button></Link>
                <Link href="/teacher/report-comments"><Button size="sm" variant="outline">Write Report</Button></Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
