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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CalendarClock, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

type TimetableEntry = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  class: { id: string; name: string };
  subject: { id: string; name: string; code: string | null };
  teacher: { id: string; firstName: string; lastName: string } | null;
  classroom: { id: string; name: string; roomNumber: string | null } | null;
};

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_LABEL = (d: string) => d.charAt(0) + d.slice(1).toLowerCase();

const EMPTY_FORM = {
  day: "MONDAY", startTime: "08:00", endTime: "09:00",
  classId: "", subjectId: "", teacherId: "", classroomId: "",
};

export default function AdminTimetablePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(() => DAYS[new Date().getDay()] ?? "MONDAY");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const load = (day: string) =>
    fetch(`/api/admin/timetable?day=${day}`)
      .then((r) => r.ok && r.json())
      .then((d) => d?.entries && setEntries(d.entries))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load(activeDay);
  }, [activeDay]);

  useEffect(() => {
    fetch("/api/admin/classes").then((r) => r.ok && r.json()).then((d) => d?.classes && setClasses(d.classes)).catch(() => {});
    fetch("/api/admin/subjects").then((r) => r.ok && r.json()).then((d) => d?.subjects && setSubjects(d.subjects)).catch(() => {});
    fetch("/api/admin/teachers").then((r) => r.ok && r.json()).then((d) => d?.teachers && setTeachers(d.teachers)).catch(() => {});
    fetch("/api/admin/classrooms").then((r) => r.ok && r.json()).then((d) => d?.classrooms && setClassrooms(d.classrooms)).catch(() => {});
  }, []);

  const openCreate = () => {
    setFormData({ ...EMPTY_FORM, day: activeDay });
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.classId || !formData.subjectId) {
      return toast({ title: "Class and subject are required", variant: "destructive" });
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          teacherId: formData.teacherId || null,
          classroomId: formData.classroomId || null,
        }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Lesson scheduled", variant: "success" });
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
      load(activeDay);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to schedule lesson",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: TimetableEntry) => {
    try {
      const res = await fetch(`/api/admin/timetable/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Lesson removed", variant: "success" });
      load(activeDay);
    } catch {
      toast({ title: "Failed to remove lesson", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" /> Timetable
          </h2>
          <p className="text-muted-foreground">Schedule lessons with automatic conflict detection</p>
        </div>
        <Button variant="gradient" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Lesson
        </Button>
      </div>

      <Tabs value={activeDay} onValueChange={setActiveDay}>
        <TabsList className="flex-wrap">
          {DAYS.map((d) => <TabsTrigger key={d} value={d}>{DAY_LABEL(d)}</TabsTrigger>)}
        </TabsList>

        <TabsContent value={activeDay} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="hidden md:table-cell">Teacher</TableHead>
                    <TableHead className="hidden md:table-cell">Room</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  )) : entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <CalendarClock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No lessons scheduled for {DAY_LABEL(activeDay)}</p>
                      </TableCell>
                    </TableRow>
                  ) : [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((e) => (
                    <TableRow key={e.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm">{e.startTime} – {e.endTime}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{e.subject.name}</p>
                          {e.subject.code && <p className="text-xs text-muted-foreground font-mono">{e.subject.code}</p>}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{e.class.name}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {e.teacher ? `${e.teacher.firstName} ${e.teacher.lastName}` : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{e.classroom?.name || "—"}</TableCell>
                      <TableCell className="text-right">
                        <ConfirmDialog
                          title="Remove lesson?"
                          description={`${e.subject.name} (${e.class.name}) on ${DAY_LABEL(e.day)} ${e.startTime}–${e.endTime} will be removed.`}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Remove lesson">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                          onConfirm={() => handleDelete(e)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add lesson dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Schedule Lesson</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Day</Label>
                <Select value={formData.day} onValueChange={(v) => setFormData({ ...formData, day: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABEL(d)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Start</Label><Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} /></div>
              <div className="space-y-2"><Label>End</Label><Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} /></div>
            </div>
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={formData.classId} onValueChange={(v) => setFormData({ ...formData, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Select value={formData.subjectId} onValueChange={(v) => setFormData({ ...formData, subjectId: v })}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teacher</Label>
                <Select value={formData.teacherId} onValueChange={(v) => setFormData({ ...formData, teacherId: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Classroom</Label>
                <Select value={formData.classroomId} onValueChange={(v) => setFormData({ ...formData, classroomId: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{classrooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scheduling...</> : "Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
