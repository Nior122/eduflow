"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Save, Loader2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Student = { id: string; firstName: string; lastName: string; admissionNumber: string };
type Class = { id: string; name: string };
type Subject = { id: string; name: string };

export default function TeacherResultsPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<string, { assignment: string; test: string; exam: string }>>({});
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("FIRST");
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
          const ss: Record<string, { assignment: string; test: string; exam: string }> = {};
          d.students.forEach((s: Student) => { ss[s.id] = { assignment: "", test: "", exam: "" }; });
          setScores(ss);
        }
      });
  }, [selectedClass]);

  const handleSave = async () => {
    if (!selectedClass || !selectedSubject) return toast({ title: "Select class and subject", variant: "destructive" });
    setSaving(true);
    try {
      for (const [studentId, s] of Object.entries(scores)) {
        if (s.assignment || s.test || s.exam) {
          await fetch("/api/results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId, classId: selectedClass, subjectId: selectedSubject,
              term: selectedTerm, session: "2025/2026",
              assignment: parseFloat(s.assignment) || 0, test: parseFloat(s.test) || 0, exam: parseFloat(s.exam) || 0,
            }),
          });
        }
      }
      toast({ title: "Results saved!", variant: "success" });
    } catch { toast({ title: "Failed to save results", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const calcTotal = (s: { assignment: string; test: string; exam: string }) =>
    (parseFloat(s.assignment) || 0) + (parseFloat(s.test) || 0) + (parseFloat(s.exam) || 0);

  const getGradeColor = (total: number) => {
    if (total >= 75) return "text-green-600"; if (total >= 65) return "text-blue-600";
    if (total >= 55) return "text-yellow-600"; if (total >= 45) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h2 className="text-2xl font-bold tracking-tight">Examination Results</h2><p className="text-muted-foreground">Enter and manage student scores</p></div>
      <Card><CardContent className="p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2"><Label>Class</Label><Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger><SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Subject</Label><Select value={selectedSubject} onValueChange={setSelectedSubject}><SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger><SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Term</Label><Select value={selectedTerm} onValueChange={setSelectedTerm}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIRST">First Term</SelectItem><SelectItem value="SECOND">Second Term</SelectItem><SelectItem value="THIRD">Third Term</SelectItem></SelectContent></Select></div>
          <div className="space-y-2 flex items-end"><Button onClick={handleSave} disabled={saving || !selectedClass || !selectedSubject} className="w-full" variant="gradient">{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save All</>}</Button></div>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Student</TableHead><TableHead className="w-20">Assign. (20)</TableHead><TableHead className="w-20">Test (20)</TableHead><TableHead className="w-20">Exam (60)</TableHead><TableHead className="w-20">Total</TableHead><TableHead className="w-16">Grade</TableHead></TableRow></TableHeader>
        <TableBody>
          {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>) :
           students.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-12"><FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">Select a class to view students</p></TableCell></TableRow> :
           students.map((s, i) => {
             const total = calcTotal(scores[s.id]);
             return <TableRow key={s.id}>
               <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
               <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
               <TableCell><Input type="number" min="0" max="20" className="h-9 w-20 text-sm" value={scores[s.id]?.assignment || ""} onChange={e => setScores({...scores, [s.id]: {...scores[s.id], assignment: e.target.value}})} /></TableCell>
               <TableCell><Input type="number" min="0" max="20" className="h-9 w-20 text-sm" value={scores[s.id]?.test || ""} onChange={e => setScores({...scores, [s.id]: {...scores[s.id], test: e.target.value}})} /></TableCell>
               <TableCell><Input type="number" min="0" max="60" className="h-9 w-20 text-sm" value={scores[s.id]?.exam || ""} onChange={e => setScores({...scores, [s.id]: {...scores[s.id], exam: e.target.value}})} /></TableCell>
               <TableCell className={`font-bold text-lg ${getGradeColor(total)}`}>{total || "—"}</TableCell>
               <TableCell>{total ? <Badge variant={total >= 75 ? "success" : total >= 55 ? "warning" : "destructive"}>{total >= 75 ? "A" : total >= 65 ? "B" : total >= 55 ? "C" : total >= 45 ? "D" : "F"}</Badge> : "—"}</TableCell>
             </TableRow>;
           })}
        </TableBody></Table>
      </CardContent></Card>
    </div>
  );
}
