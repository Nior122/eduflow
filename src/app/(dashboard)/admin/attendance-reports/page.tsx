"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Download, Save, Loader2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type TeacherOption = { id: string; firstName: string; lastName: string; staffId: string | null };
type StaffRecord = { id: string; teacherId: string; status: string; teacher: { firstName: string; lastName: string; staffId: string | null } };
type ReportRow = { id: string; name: string; admissionNumber: string; class: string | null; counts: Record<string, number>; total: number; rate: number };

const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "SICK"];

const statusBadge = (s: string) =>
  s === "PRESENT" ? "success" : s === "ABSENT" ? "destructive" : s === "LATE" ? "warning" : s === "SICK" ? "info" : "secondary";

export default function AttendanceReportsPage() {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [classId, setClassId] = useState("");
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  const [staffDate, setStaffDate] = useState(new Date().toISOString().slice(0, 10));
  const [staffStatuses, setStaffStatuses] = useState<Record<string, string>>({});
  const [staffSaving, setStaffSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/classes").then((r) => r.ok && r.json()).then((d) => d?.classes && setClasses(d.classes)).catch(() => {});
    fetch("/api/admin/teachers").then((r) => r.ok && r.json()).then((d) => {
      if (d?.teachers) {
        setTeachers(d.teachers);
        const init: Record<string, string> = {};
        d.teachers.forEach((t: TeacherOption) => { init[t.id] = "PRESENT"; });
        setStaffStatuses(init);
      }
    }).catch(() => {});
  }, []);

  const loadReport = () => {
    setReportLoading(true);
    const params = new URLSearchParams({ from, to });
    if (classId) params.set("classId", classId);
    fetch(`/api/attendance/report?${params}`)
      .then((r) => r.ok && r.json())
      .then((d) => setRows(d?.students ?? []))
      .catch(() => toast({ title: "Failed to load report", variant: "destructive" }))
      .finally(() => setReportLoading(false));
  };

  useEffect(() => {
    loadReport();
  }, [classId]);

  const exportCsv = () => {
    const params = new URLSearchParams({ from, to, format: "csv" });
    if (classId) params.set("classId", classId);
    window.open(`/api/attendance/report?${params}`, "_blank");
  };

  const loadStaff = (date: string) => {
    fetch(`/api/staff-attendance?date=${date}`)
      .then((r) => r.ok && r.json())
      .then((d) => {
        const next: Record<string, string> = {};
        teachers.forEach((t) => { next[t.id] = "PRESENT"; });
        (d?.records ?? []).forEach((r: StaffRecord) => { next[r.teacherId] = r.status; });
        setStaffStatuses(next);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (teachers.length > 0) loadStaff(staffDate);
  }, [teachers, staffDate]);

  const saveStaff = async () => {
    setStaffSaving(true);
    try {
      const res = await fetch("/api/staff-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: staffDate,
          records: Object.entries(staffStatuses).map(([teacherId, status]) => ({ teacherId, status })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: `Staff attendance saved (${data.count})`, variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save", variant: "destructive" });
    } finally {
      setStaffSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Attendance Reports
        </h2>
        <p className="text-muted-foreground">Student attendance summaries and staff attendance</p>
      </div>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Student Attendance</TabsTrigger>
          <TabsTrigger value="staff">Staff Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                <div className="space-y-2"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                <div className="flex items-end gap-2">
                  <Button onClick={loadReport} disabled={reportLoading} className="flex-1">
                    {reportLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Run Report
                  </Button>
                  <Button variant="outline" onClick={exportCsv} aria-label="Export CSV">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden md:table-cell">Class</TableHead>
                    <TableHead className="text-center">P</TableHead>
                    <TableHead className="text-center">A</TableHead>
                    <TableHead className="text-center">L</TableHead>
                    <TableHead className="text-center">E</TableHead>
                    <TableHead className="text-center">S</TableHead>
                    <TableHead className="text-center">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportLoading ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}><TableCell><Skeleton className="h-8 w-40" /></TableCell><TableCell><Skeleton className="h-8 w-20" /></TableCell><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  )) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No attendance records in this period</TableCell></TableRow>
                  ) : rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{r.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.admissionNumber}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{r.class ?? "—"}</TableCell>
                      <TableCell className="text-center text-sm">{r.counts.PRESENT ?? 0}</TableCell>
                      <TableCell className="text-center text-sm">{r.counts.ABSENT ?? 0}</TableCell>
                      <TableCell className="text-center text-sm">{r.counts.LATE ?? 0}</TableCell>
                      <TableCell className="text-center text-sm">{r.counts.EXCUSED ?? 0}</TableCell>
                      <TableCell className="text-center text-sm">{r.counts.SICK ?? 0}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={r.rate >= 75 ? "success" : r.rate >= 50 ? "warning" : "destructive"}>{r.rate}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={staffDate} onChange={(e) => setStaffDate(e.target.value)} />
                </div>
                <Button onClick={saveStaff} disabled={staffSaving} variant="gradient">
                  {staffSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Staff Attendance</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.length === 0 ? (
                    <TableRow><TableCell colSpan={2} className="text-center py-12 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2" /> No teachers yet
                    </TableCell></TableRow>
                  ) : teachers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{t.firstName} {t.lastName}</p>
                        <p className="text-xs text-muted-foreground">{t.staffId ?? "—"}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {STATUSES.map((s) => (
                            <button
                              key={s}
                              onClick={() => setStaffStatuses((prev) => ({ ...prev, [t.id]: s }))}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                staffStatuses[t.id] === s
                                  ? s === "PRESENT" ? "bg-green-100 text-green-700 border-green-200"
                                    : s === "ABSENT" ? "bg-red-100 text-red-700 border-red-200"
                                    : s === "LATE" ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                                    : s === "SICK" ? "bg-blue-100 text-blue-700 border-blue-200"
                                    : "bg-gray-100 text-gray-700 border-gray-200"
                                  : "border-input text-muted-foreground hover:bg-accent"
                              }`}
                            >
                              {s === "PRESENT" ? "P" : s === "ABSENT" ? "A" : s === "LATE" ? "L" : s === "SICK" ? "S" : "E"}
                            </button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
