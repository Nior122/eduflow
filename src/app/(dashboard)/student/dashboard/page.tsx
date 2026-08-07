"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, BarChart3, ArrowRight, Brain, Loader2, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";

type Analysis = {
  strengths: string[];
  weaknesses: string[];
  riskLevel: string;
  overallScore: number;
  recommendations: string[];
};

export default function StudentDashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<{ name: string; class: string; avgScore: number; attendance: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  useEffect(() => {
    fetch("/api/student/dashboard").then(r => r.ok && r.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const runAnalysis = async () => {
    const studentId = session?.user?.studentId;
    if (!studentId) return toast({ title: "No student profile linked to this account", variant: "destructive" });
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisOpen(true);
    try {
      const res = await fetch("/api/ai/analyze-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to analyze");
      setAnalysis(d);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to analyze performance", variant: "destructive" });
      setAnalysisOpen(false);
    } finally {
      setAnalyzing(false);
    }
  };

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
        <button className="text-left" onClick={runAnalysis} aria-label="Run performance analysis">
          <Card className="hover:shadow-md transition-all cursor-pointer h-full"><CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10"><BarChart3 className="h-6 w-6 text-amber-500" /></div>
            <div className="flex-1"><h3 className="font-semibold">Performance Analysis</h3><p className="text-sm text-muted-foreground">See your strengths and areas to improve</p></div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent></Card>
        </button>
      </div>

      {/* Analysis dialog */}
      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> Performance Analysis
            </DialogTitle>
          </DialogHeader>
          {analyzing || !analysis ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing your results and attendance...</p>
            </div>
          ) : (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <Card><CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{analysis.overallScore ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">Overall Score</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <Badge variant={analysis.riskLevel === "LOW" ? "success" : analysis.riskLevel === "MEDIUM" ? "warning" : "destructive"} className="mt-2">
                    {analysis.riskLevel} RISK
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">Risk Level</p>
                </CardContent></Card>
              </div>
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1 mb-1 text-green-600"><TrendingUp className="h-4 w-4" /> Strengths</h4>
                <p className="text-sm text-muted-foreground">{analysis.strengths.length ? analysis.strengths.join(", ") : "None identified yet"}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1 mb-1 text-amber-600"><AlertTriangle className="h-4 w-4" /> Areas to improve</h4>
                <p className="text-sm text-muted-foreground">{analysis.weaknesses.length ? analysis.weaknesses.join(", ") : "None identified yet"}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1 mb-1"><CheckCircle2 className="h-4 w-4" /> Recommendations</h4>
                <ul className="space-y-1">
                  {analysis.recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary">•</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
