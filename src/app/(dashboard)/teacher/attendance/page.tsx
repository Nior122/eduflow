"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CalendarDays, Save, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
};

type Class = { id: string; name: string };
type Subject = { id: string; name: string };

export default function AttendancePage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/classes").then(r => r.ok && r.json()),
      fetch("/api/admin/subjects").then(r => r.ok && r.json()),
    ]).then(([cls, subj]) => {
      if (cls?.classes) setClasses(cls.classes);
      if (subj?.subjects) setSubjects(subj.subjects);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    fetch(`/api/admin/students?classId=${selectedClass}&limit=100`)
      .then(r => r.ok && r.json())
      .then(d => {
        if (d?.students) {
          setStudents(d.students);
          const defaultRecords: Record<string, string> = {};
          d.students.forEach((s: Student) => { defaultRecords[s.id] = "PRESENT"; });
          setRecords(defaultRecords);
        }
      })
      .catch(() => {});
  }, [selectedClass]);

  // Prefill saved attendance for the selected class/date/subject
  useEffect(() => {
    if (!selectedClass || !selectedDate || students.length === 0) return;
    setPrefillLoading(true);
    const params = new URLSearchParams({ classId: selectedClass, date: selectedDate });
    if (selectedSubject) params.set("subjectId", selectedSubject);
    fetch(`/api/attendance?${params}`)
      .then(r => r.ok && r.json())
      .then(d => {
        setRecords((prev) => {
          const next = { ...prev };
          (d?.attendances ?? []).forEach((a: { studentId: string; status: string }) => {
            if (next[a.studentId] !== undefined) next[a.studentId] = a.status;
          });
          return next;
        });
      })
      .catch(() => {})
      .finally(() => setPrefillLoading(false));
  }, [selectedClass, selectedDate, selectedSubject, students.length]);

  const handleSave = async () => {
    if (!selectedClass || !selectedDate) {
      return toast({ title: "Select class and date", variant: "destructive" });
    }
    setSaving(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClass,
          date: selectedDate,
          subjectId: !selectedSubject || selectedSubject === "all" ? null : selectedSubject,
          records: Object.entries(records).map(([studentId, status]) => ({ studentId, status })),
        }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: `Attendance saved (${data.count ?? records.length} students)`, variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save attendance", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PRESENT": return "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200";
      case "ABSENT": return "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200";
      case "LATE": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400 border-yellow-200";
      case "EXCUSED": return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200";
      case "SICK": return "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200";
      default: return "";
    }
  };

  const statusCounts = {
    PRESENT: Object.values(records).filter(v => v === "PRESENT").length,
    ABSENT: Object.values(records).filter(v => v === "ABSENT").length,
    LATE: Object.values(records).filter(v => v === "LATE").length,
    EXCUSED: Object.values(records).filter(v => v === "EXCUSED").length,
    SICK: Object.values(records).filter(v => v === "SICK").length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Attendance</h2>
        <p className="text-muted-foreground">Take daily attendance for your classes</p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject (optional)</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger><SelectValue placeholder="All subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2 flex items-end">
              <Button onClick={handleSave} disabled={saving || !selectedClass} className="w-full" variant="gradient">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Attendance</>}
              </Button>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <RefreshCw className={`h-3 w-3 ${prefillLoading ? "animate-spin" : ""}`} />
            {prefillLoading ? "Loading saved attendance..." : "Saved records for the selected class, date, and subject are loaded automatically."}
          </p>
        </CardContent>
      </Card>

      {/* Status Summary */}
      {students.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className={`rounded-lg border p-3 text-center ${getStatusColor(status)}`}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs">{status.charAt(0) + status.slice(1).toLowerCase()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Student List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Student Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead className="hidden sm:table-cell">Admission No.</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell><Skeleton className="h-8 w-8" /></TableCell><TableCell><Skeleton className="h-8 w-48" /></TableCell><TableCell><Skeleton className="h-8 w-24" /></TableCell><TableCell><Skeleton className="h-8 w-32 ml-auto" /></TableCell></TableRow>
                ))
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Select a class to view students</p>
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student, index) => (
                  <TableRow key={student.id}>
                    <TableCell className="text-muted-foreground text-sm">{index + 1}</TableCell>
                    <TableCell className="font-medium">{student.firstName} {student.lastName}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{student.admissionNumber}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {["PRESENT", "ABSENT", "LATE", "EXCUSED", "SICK"].map((status) => (
                          <button
                            key={status}
                            onClick={() => setRecords({ ...records, [student.id]: status })}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                              records[student.id] === status
                                ? getStatusColor(status)
                                : "border-input text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            {status === "PRESENT" ? "P" : status === "ABSENT" ? "A" : status === "LATE" ? "L" : status === "EXCUSED" ? "E" : "S"}
                          </button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
