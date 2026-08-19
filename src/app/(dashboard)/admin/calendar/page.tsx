"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, CalendarDays, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  type: string;
  class: { id: string; name: string } | null;
};

const TYPES = ["EXAM", "SCHOOL_OPENING", "SCHOOL_CLOSING", "SPORTS", "PTA_MEETING", "HOLIDAY", "ASSIGNMENT", "EVENT"] as const;

const typeVariant = (t: string) =>
  t === "EXAM" ? "destructive" : t === "HOLIDAY" ? "warning" : t === "SPORTS" || t === "PTA_MEETING" ? "info" : "default";

const EMPTY_FORM = { title: "", description: "", eventDate: "", startTime: "", endTime: "", type: "EVENT", classId: "" };

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const load = () => {
    const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
    return fetch(`/api/admin/calendar?from=${from}&to=${to}`)
      .then((r) => r.ok && r.json())
      .then((d) => d?.events && setEvents(d.events))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch("/api/admin/classes").then((r) => r.ok && r.json()).then((d) => d?.classes && setClasses(d.classes)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (e: CalendarEvent) => {
    setEditing(e);
    setFormData({
      title: e.title,
      description: e.description ?? "",
      eventDate: e.eventDate.slice(0, 10),
      startTime: e.startTime ?? "",
      endTime: e.endTime ?? "",
      type: e.type,
      classId: e.class?.id ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.eventDate) {
      return toast({ title: "Title and date are required", variant: "destructive" });
    }
    setSaving(true);
    try {
      const payload = { ...formData, classId: formData.classId || null };
      const res = editing
        ? await fetch(`/api/admin/calendar/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/calendar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: editing ? "Event updated" : "Event created", variant: "success" });
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save event", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: CalendarEvent) => {
    try {
      const res = await fetch(`/api/admin/calendar/${e.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Event deleted", variant: "success" });
      load();
    } catch {
      toast({ title: "Failed to delete event", variant: "destructive" });
    }
  };

  // Group by month
  const months = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = e.eventDate.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(e);
  }
  const sortedMonths = [...months.keys()].sort();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> School Calendar
          </h2>
          <p className="text-muted-foreground">Openings, closings, exams, sports, meetings, and holidays</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Edit Event" : "Add Event"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>Title *</Label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Date *</Label><Input type="date" value={formData.eventDate} onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Start Time</Label><Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} /></div>
                <div className="space-y-2"><Label>End Time</Label><Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Class (optional)</Label>
                <Select value={formData.classId} onValueChange={(v) => setFormData({ ...formData, classId: v })}>
                  <SelectTrigger><SelectValue placeholder="Whole school" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editing ? "Save Changes" : "Add Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : events.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No events in the next 6 months</p>
        </CardContent></Card>
      ) : sortedMonths.map((month) => (
        <div key={month} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {new Date(month + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h3>
          {months.get(month)!.map((e) => (
            <Card key={e.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-xl font-bold leading-none">{new Date(e.eventDate).getDate()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(e.eventDate).toLocaleDateString(undefined, { month: "short" })}</p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={typeVariant(e.type) as "default" | "destructive" | "warning" | "info" | undefined}>
                        {e.type.replace(/_/g, " ")}
                      </Badge>
                      {e.class && <Badge variant="secondary">{e.class.name}</Badge>}
                    </div>
                    <p className="font-medium mt-1">{e.title}</p>
                    {e.description && <p className="text-xs text-muted-foreground line-clamp-1">{e.description}</p>}
                    {(e.startTime || e.endTime) && (
                      <p className="text-xs text-muted-foreground mt-0.5">{e.startTime ?? ""}{e.startTime && e.endTime ? " – " : ""}{e.endTime ?? ""}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${e.title}`} onClick={() => openEdit(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDialog
                    title="Delete event?"
                    description={`"${e.title}" (${formatDate(e.eventDate)}) will be removed.`}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${e.title}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                    onConfirm={() => handleDelete(e)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}
