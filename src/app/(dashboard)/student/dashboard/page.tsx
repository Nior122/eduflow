"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sparkles, BookOpen, BarChart3, ArrowRight, Brain } from "lucide-react";
import Link from "next/link";

export default function StudentDashboardPage() {
  const [data, setData] = useState<{ name: string; class: string; avgScore: number; attendance: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/dashboard").then(r => r.ok && r.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-6"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h2 className="text-2xl font-bold">Student Dashboard</h2><p className="text-muted-foreground">{data?.name ? `Welcome, ${data.name}!` : "Welcome!"}</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-6 text-center"><p className="text-sm text-muted-foreground">Class</p><p className="text-2xl font-bold">{data?.class || "—"}</p></CardContent></Card>
        <Card><CardContent className="p-6 text-center"><p className="text-sm text-muted-foreground">Average Score</p><p className="text-2xl font-bold text-primary">{data?.avgScore || 0}%</p></CardContent></Card>
        <Card><CardContent className="p-6 text-center"><p className="text-sm text-muted-foreground">Attendance</p><p className="text-2xl font-bold text-green-500">{data?.attendance || 0}%</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/student/homework-assistant">
          <Card className="gradient-card border-primary/20 hover:shadow-md transition-all cursor-pointer"><CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"><Sparkles className="h-6 w-6 text-primary" /></div>
            <div className="flex-1"><h3 className="font-semibold">AI Homework Assistant</h3><p className="text-sm text-muted-foreground">Ask any question and get instant help</p></div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent></Card>
        </Link>
        <Card className="hover:shadow-md transition-all"><CardContent className="p-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10"><BarChart3 className="h-6 w-6 text-amber-500" /></div>
          <div><h3 className="font-semibold">Performance Analysis</h3><p className="text-sm text-muted-foreground">See your strengths and areas to improve</p></div>
        </CardContent></Card>
      </div>
    </div>
  );
}
