"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Save, Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { calculateGrade } from "@/lib/utils";

type Student = { id: string; firstName: string; lastName: string; admissionNumber: string };
type Class = { id: string; name: string };
type Subject = { id: string; name: string };
type Scores = Record<string, { assignment: string; test: string; exam: string }>;

const SESSIONS = ["2024/2025", "2025/2026", "2026/2027"];

const emptyScores = (students: Student[]): Scores => {
  const ss: Scores = {};
  students.forEach((s) => { ss[s.id] = { assignment: "", test: "", exam: "" }; });
  return ss;
};

export default function TeacherResultsPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Scores>({});
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("FIRST");
  const [selectedSession, setSelectedSession] = useState("2025/2026");
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/classes").then(r => r.ok && r.json()),
      fetch("/api/admin/subjects").then(r => r.ok && r.json()),
    ]).then(([c, s]) => {
      if (c?.classes) setClasses(c.classes);
      if (s?.subjects) setSubjects(s.subjects);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    fetch(`/api/admin/students?classId=${selectedClass}&limit=100`)
      .then(r => r.ok && r.json())
      .then(d => {
        if (d?.students) {
          setStudents(d.students);
          setScores(emptyScores(d.students));
        }
      });
  }, [selectedClass]);

  // Prefill existing results for the selected class/subject/term/session
  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;
    setPrefillLoading(true);
    const params = new URLSearchParams({ classId: selectedClass, subjectId: selectedSubject, term: selectedTerm, session: selectedSession });
    fetch(`/api/results?${params}`)
      .then(r => r.ok && r.json())
      .then(d => {
        setScores((prev) => {
          const next = { ...prev };
          (d?.results ?? []).forEach((r: { studentId: string; assignment: string | null; test: string | null; exam: string | null }) => {
            if (next[r.studentId]) {
              next[r.studentId] = {
                assignment: r.assignment != null ? String(r.assignment) : "",
                test: r.test != null ? String(r.test) : "",
                exam: r.exam != null ? String(r.exam) : "",
              };
            }
          });
          return next;
        });
      })
      .catch(() => {})
      .finally(() => setPrefillLoading(false));
  }, [selectedClass, selectedSubject, selectedTerm, selectedSession]);

  const handleSave = async () => {
    if (!selectedClass || !selectedSubject) return toast({ title: "Select class and subject", variant: "destructive" });
    setSaving(true);
    try {
      let saved = 0;
      for (const [studentId, s] of Object.entries(scores)) {
        if (s.assignment || s.test || s.exam) {
          const res = await fetch("/api/results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId, classId: selectedClass, subjectId: selectedSubject,
              term: selectedTerm, session: selectedSession,
              assignment: parseFloat(s.assignment) || 0, test: parseFloat(s.test) || 0, exam: parseFloat(s.exam) || 0,
            }),
          });
          if (!res.ok) throw new Error("Failed");
          saved++;
        }
      }
      toast({ title: saved > 0 ? `${saved} result${saved > 1 ? "s" : ""} saved!` : "Nothing to save", variant: "success" });
    } catch { toast({ title: "Failed to save results", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const calcTotal = (s: { assignment: string; test: string; exam: string }) =>
    (parseFloat(s.assignment) || 0) + (parseFloat(s.test) || 0) + (parseFloat(s.exam) || 0);

  const getGradeColor = (total: number) => {
    if (total >= 75) return "text-green-600"; if (total >= 60) return "text-blue-600";
    if (total >= 50) return "text-yellow-600"; if (total >= 40) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h2 className="text-2xl font-bold tracking-tight">Examination Results</h2><p className="text-muted-foreground">Enter and manage student scores</p></div>
      <Card><CardContent className="p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2"><Label>Class</Label><Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger><SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Subject</Label><Select value={selectedSubject} onValueChange={setSelectedSubject}><SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger><SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Term</Label><Select value={selectedTerm} onValueChange={setSelectedTerm}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIRST">First Term</SelectItem><SelectItem value="SECOND">Second Term</SelectItem><SelectItem value="THIRD">Third Term</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Session</Label><Select value={selectedSession} onValueChange={setSelectedSession}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SESSIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2 flex items-end">
            <Button onClick={handleSave} disabled={saving || !selectedClass || !selectedSubject} className="w-full" variant="gradient">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save All</>}
            </Button>
          </div>
        </div>
        {selectedClass && selectedSubject && (
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <RefreshCw className={`h-3 w-3 ${prefillLoading ? "animate-spin" : ""}`} />
            {prefillLoading ? "Loading saved scores..." : "Saved scores are loaded automatically when you change class, subject, term, or session."}
          </p>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Student</TableHead><TableHead className="w-20">Assign. (20)</TableHead><TableHead className="w-20">Test (20)</TableHead><TableHead className="w-20">Exam (60)</TableHead><TableHead className="w-20">Total</TableHead><TableHead className="w-16">Grade</TableHead></TableRow></TableHeader>
        <TableBody>
          {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>) :
           students.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-12"><FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">Select a class to view students</p></TableCell></TableRow> :
           students.map((s, i) => {
             const total = calcTotal(scores[s.id]);
             const grade = total > 0 ? calculateGrade(total) : null;
             return <TableRow key={s.id}>
               <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
               <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
               <TableCell><Input type="number" min="0" max="20" className="h-9 w-20 text-sm" value={scores[s.id]?.assignment || ""} onChange={e => setScores({...scores, [s.id]: {...scores[s.id], assignment: e.target.value}})} /></TableCell>
               <TableCell><Input type="number" min="0" max="20" className="h-9 w-20 text-sm" value={scores[s.id]?.test || ""} onChange={e => setScores({...scores, [s.id]: {...scores[s.id], test: e.target.value}})} /></TableCell>
               <TableCell><Input type="number" min="0" max="60" className="h-9 w-20 text-sm" value={scores[s.id]?.exam || ""} onChange={e => setScores({...scores, [s.id]: {...scores[s.id], exam: e.target.value}})} /></TableCell>
               <TableCell className={`font-bold text-lg ${getGradeColor(total)}`}>{total || "—"}</TableCell>
               <TableCell>{grade ? <Badge variant={total >= 75 ? "success" : total >= 55 ? "warning" : "destructive"}>{grade}</Badge> : "—"}</TableCell>
             </TableRow>;
           })}
        </TableBody></Table>
      </CardContent></Card>
    </div>
  );
}
