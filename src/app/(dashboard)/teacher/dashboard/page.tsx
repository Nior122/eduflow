"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, BookOpen, ClipboardCheck, Brain, FileSpreadsheet,
  CalendarClock, BellRing, AlertCircle, Sparkles, NotebookPen, ClipboardList,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelativeTime } from "@/lib/utils";

type DashboardStats = {
  students: number;
  classes: number;
  subjects: number;
  attendanceToday: number;
  pendingAttendance: number;
  awaitingGrading: number;
  todayClasses: { id: string; startTime: string; endTime: string; subject: string; className: string }[];
  upcomingEvents: { id: string; title: string; type: string; eventDate: string }[];
  unreadNotifications: number;
  recentMessages: { id: string; subject: string; snippet: string; createdAt: string; otherName: string; incoming: boolean }[];
};

export default function TeacherDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
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
    { label: "Assignments", icon: ClipboardList, href: "/teacher/assignments", color: "text-cyan-500" },
    { label: "Homework", icon: NotebookPen, href: "/teacher/homework", color: "text-pink-500" },
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
            <StatCard title="My Students" value={stats?.students ?? 0} icon={Users} description="assigned classes" />
            <StatCard title="Classes" value={stats?.classes ?? 0} icon={BookOpen} description="assigned" />
            <StatCard title="Attendance Today" value={stats ? `${stats.attendanceToday}%` : "0%"} icon={ClipboardCheck} description="marked today" />
            <StatCard
              title="Awaiting Grading"
              value={stats?.awaitingGrading ?? 0}
              icon={AlertCircle}
              description={stats?.pendingAttendance ? `+ ${stats.pendingAttendance} attendance pending` : undefined}
            />
          </>
        )}
      </div>

      {/* Today's classes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarClock className="h-5 w-5" /> Today&apos;s Classes
            </CardTitle>
            <Link href="/teacher/timetable">
              <Button variant="outline" size="sm">Full timetable</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (stats?.todayClasses ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No lessons scheduled for today</p>
            ) : (
              <div className="space-y-2">
                {stats!.todayClasses.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{c.subject}</p>
                      <p className="text-xs text-muted-foreground">{c.className}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">{c.startTime}–{c.endTime}</Badge>
                  </div>
                ))}
                {stats!.pendingAttendance > 0 && (
                  <Link href="/teacher/attendance" className="block">
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {stats!.pendingAttendance} class{stats!.pendingAttendance > 1 ? "es" : ""} still need attendance today
                    </div>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BellRing className="h-5 w-5" /> Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (stats?.upcomingEvents ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No upcoming events</p>
            ) : (
              <div className="space-y-2">
                {stats!.upcomingEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.type.replace(/_/g, " ")}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{formatDate(e.eventDate)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Messages & notifications */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Recent Messages
            </CardTitle>
            <Link href="/messages">
              <Button variant="outline" size="sm">Open inbox</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (stats?.recentMessages ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No messages yet</p>
            ) : (
              <div className="space-y-2">
                {stats!.recentMessages.map((m) => (
                  <Link key={m.id} href="/messages" className="block">
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-accent/50 transition-colors">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {m.incoming && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />}
                          {m.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{m.otherName} — {m.snippet}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(m.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BellRing className="h-5 w-5" /> Notifications
            </CardTitle>
            <Link href="/notifications">
              <Button variant="outline" size="sm">View all</Button>
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-4xl font-bold text-primary">{stats?.unreadNotifications ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-1">
              unread notification{stats?.unreadNotifications === 1 ? "" : "s"}
            </p>
            <Link href="/notifications" className="mt-3">
              <Button variant="ghost" size="sm">Open notification center</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-3">
        {quickActions.map((action) => (
          <Link key={action.label} href={action.href}>
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ${action.color}`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{action.label}</h3>
                  <p className="text-xs text-muted-foreground">Get started now</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
