"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, Download, BarChart3 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Session = { id: string; name: string; terms: { id: string; name: string }[] };
type ClassRow = { id: string; name: string };

type ReportRow = { type: string; title: string; columns: string[]; rows: (string | number)[][]; totals: Record<string, number> };

const REPORT_TYPES: Record<string, string> = {
  daily: "Daily revenue",
  weekly: "Weekly revenue",
  monthly: "Monthly revenue",
  annual: "Annual revenue",
  custom: "Custom range",
  outstanding: "Outstanding fees",
  discounts: "Discounts & scholarships",
  methods: "Payment methods",
  cashflow: "Cash flow (monthly)",
  class: "Revenue by class",
  department: "Revenue by department",
};

export default function FinanceReportsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [type, setType] = useState("monthly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [report, setReport] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/sessions").then((r) => parseJsonBody(r)),
      fetch("/api/admin/classes").then((r) => parseJsonBody(r)),
    ]).then(([s, c]) => {
      setSessions(s.sessions ?? []);
      setClasses(c.classes ?? []);
    }).catch(() => {});
  }, []);

  const run = useCallback(async (format: "json" | "csv" = "json") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type, format });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (sessionId) params.set("sessionId", sessionId);
      if (termId) params.set("termId", termId);
      if (classId) params.set("classId", classId);
      const res = await fetch(`/api/finance/reports?${params}`);
      if (!res.ok) {
        const data = await parseJsonBody(res).catch(() => ({}));
        throw new Error(data.error || "Report failed");
      }
      if (format === "csv") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `eduflow-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "CSV downloaded" });
        return;
      }
      const data = await parseJsonBody(res);
      setReport(data.report);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Report failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [type, from, to, sessionId, termId, classId]);

  const totalLabel = report?.totals ? Object.entries(report.totals).map(([k, v]) => `${k}: ${v}`).join(" · ") : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Financial Reports</h2>
          <p className="text-sm text-muted-foreground">Revenue, outstanding, discounts, methods, cash flow — view or export as CSV.</p>
        </div>
        <Button variant="outline" onClick={() => run("csv")} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Download CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Report</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REPORT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {["custom", "outstanding", "methods", "class"].includes(type) && (
              <div className="space-y-1.5">
                <Label className="text-xs">From</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
            )}
            {["custom", "outstanding", "methods", "class"].includes(type) && (
              <div className="space-y-1.5">
                <Label className="text-xs">To</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            )}
            {["outstanding"].includes(type) && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Session</Label>
                  <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setTermId(sessions.find((s) => s.id === v)?.terms?.[0]?.id ?? ""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Term</Label>
                  <Select value={termId} onValueChange={setTermId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {sessions.find((s) => s.id === sessionId)?.terms.map((t) => (
                        <SelectItem key={t.id} value={t.id}>Term {t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Class</Label>
                  <Select value={classId} onValueChange={(v) => setClassId(v === "__all" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">All</SelectItem>
                      {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="flex items-end">
              <Button onClick={() => run("json")} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-1" />}
                Run report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>
      ) : report ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{report.title} <span className="text-xs font-normal text-muted-foreground">· generated {new Date().toLocaleString()}</span></CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {report.columns.map((c) => <TableHead key={c} className={c === "Amount" || c === "Revenue" || c === "Balance" || c === "Total Discounted" ? "text-right" : ""}>{c}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((r, i) => (
                  <TableRow key={i}>
                    {r.map((cell, j) => {
                      const numeric = typeof cell === "number" || (typeof cell === "string" && !isNaN(Number(cell)) && report.columns[j] !== "Period" && report.columns[j] !== "Month" && report.columns[j] !== "Method" && report.columns[j] !== "Student" && report.columns[j] !== "Admission No" && report.columns[j] !== "Class" && report.columns[j] !== "Discount Type" && report.columns[j] !== "Department");
                      return <TableCell key={j} className={numeric ? "text-right font-medium" : "text-sm"}>{numeric ? formatCurrency(Number(cell)) : cell}</TableCell>;
                    })}
                  </TableRow>
                ))}
                {report.rows.length === 0 && (
                  <TableRow><TableCell colSpan={report.columns.length} className="text-center py-8 text-muted-foreground">No data for this report.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {totalLabel && (
              <div className="px-6 py-3 border-t text-sm text-muted-foreground">
                Totals: <b className="text-foreground">{totalLabel}</b>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Pick a report type and press Run.</CardContent></Card>
      )}
    </div>
  );
}
