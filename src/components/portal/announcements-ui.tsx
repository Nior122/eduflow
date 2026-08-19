"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Megaphone,
  Pin,
  PinOff,
  Trash2,
  Loader2,
  Plus,
  AlertTriangle,
  Info,
  CheckCircle2,
  CalendarDays,
  Users,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Announcement = {
  id: string;
  title: string;
  content: string;
  priority: string;
  audience: string;
  published: boolean;
  pinned: boolean;
  expiresAt: string | null;
  isExpired: boolean;
  attachmentUrl: string | null;
  targetClass: { id: string; name: string } | null;
  targetDepartment: { id: string; name: string } | null;
  author: { id: string; name: string } | null;
  createdAt: string;
};

type ClassItem = { id: string; name: string };
type DeptItem = { id: string; name: string };

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  NORMAL: "bg-primary/10 text-primary",
  HIGH: "bg-amber-500/15 text-amber-600",
  URGENT: "bg-destructive/15 text-destructive",
};

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: "Entire School",
  TEACHERS: "Teachers",
  PARENTS: "Parents",
  STUDENTS: "Students",
  STAFF: "Staff",
  CLASS: "Class",
  DEPARTMENT: "Department",
};

export function AnnouncementsUI({ canManage = false }: { canManage?: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [departments, setDepts] = useState<DeptItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [audience, setAudience] = useState("ALL");
  const [targetClassId, setTargetClassId] = useState("");
  const [targetDepartmentId, setTargetDepartmentId] = useState("");
  const [pinned, setPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/announcements");
      const data = await parseJsonBody(res);
      if (res.ok && data?.announcements) setItems(data.announcements);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (canManage) {
      fetch("/api/admin/classes").then((r) => parseJsonBody(r)).then((d) => d?.classes && setClasses(d.classes)).catch(() => {});
      fetch("/api/admin/departments").then((r) => parseJsonBody(r)).then((d) => d?.departments && setDepts(d.departments)).catch(() => {});
    }
  }, [load, canManage]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setPriority("NORMAL");
    setAudience("ALL");
    setTargetClassId("");
    setTargetDepartmentId("");
    setPinned(false);
    setExpiresAt("");
    setEditing(null);
  };

  const openCompose = (a?: Announcement) => {
    setEditing(a ?? null);
    setTitle(a?.title ?? "");
    setContent(a?.content ?? "");
    setPriority(a?.priority ?? "NORMAL");
    setAudience(a?.audience ?? "ALL");
    setTargetClassId(a?.targetClass?.id ?? "");
    setTargetDepartmentId(a?.targetDepartment?.id ?? "");
    setPinned(a?.pinned ?? false);
    setExpiresAt(a?.expiresAt ? a.expiresAt.slice(0, 16) : "");
    setComposeOpen(true);
  };

  const submit = async () => {
    if (!title.trim() || !content.trim()) return toast({ title: "Title and content are required", variant: "destructive" });
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        priority,
        audience,
        pinned,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        targetClassId: audience === "CLASS" ? targetClassId || undefined : undefined,
        targetDepartmentId: audience === "DEPARTMENT" ? targetDepartmentId || undefined : undefined,
      };
      const res = await fetch(editing ? `/api/admin/announcements/${editing.id}` : "/api/announcements", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast({ title: editing ? "Announcement updated" : "Announcement published — recipients notified", variant: "success" });
      setComposeOpen(false);
      resetForm();
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (a: Announcement) => {
    try {
      const res = await fetch(`/api/admin/announcements/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !a.pinned }),
      });
      if (res.ok) {
        toast({ title: a.pinned ? "Unpinned" : "Pinned", variant: "success" });
        load();
      }
    } catch {
      /* ignore */
    }
  };

  const remove = async (a: Announcement) => {
    try {
      const res = await fetch(`/api/admin/announcements/${a.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Announcement deleted" });
        load();
      }
    } catch {
      /* ignore */
    }
  };

  const audienceLabel = (a: Announcement) =>
    a.audience === "CLASS" && a.targetClass ? `Class: ${a.targetClass.name}` :
    a.audience === "DEPARTMENT" && a.targetDepartment ? `Department: ${a.targetDepartment.name}` :
    AUDIENCE_LABELS[a.audience] ?? a.audience;

  const priorityIcon = (p: string) =>
    p === "URGENT" ? <AlertTriangle className="h-3.5 w-3.5" /> :
    p === "HIGH" ? <AlertTriangle className="h-3.5 w-3.5" /> :
    p === "LOW" ? <Info className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" /> Announcements
          </h2>
          <p className="text-muted-foreground">School news, circulars and updates</p>
        </div>
        {canManage && (
          <Button variant="gradient" onClick={() => openCompose()}>
            <Plus className="mr-1 h-4 w-4" /> New Announcement
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-semibold">No announcements</h3>
            <p className="text-muted-foreground text-sm">Announcements from the school will appear here.</p>
          </div>
        ) : (
          items.map((a) => (
            <Card key={a.id} className={cn(a.pinned && "border-primary/40")}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.pinned && (
                      <Badge className="bg-primary/10 text-primary border-0"><Pin className="h-3 w-3 mr-1" /> Pinned</Badge>
                    )}
                    <Badge className={cn("border-0", PRIORITY_STYLES[a.priority] ?? PRIORITY_STYLES.NORMAL)}>
                      {priorityIcon(a.priority)} {a.priority}
                    </Badge>
                    <Badge variant="secondary">{audienceLabel(a)}</Badge>
                    {a.isExpired && <Badge variant="secondary" className="text-muted-foreground">Expired</Badge>}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePin(a)} title={a.pinned ? "Unpin" : "Pin"}>
                        {a.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCompose(a)} title="Edit">
                        <Plus className="h-4 w-4 rotate-45" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(a)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <h3 className="mt-3 text-lg font-semibold">{a.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
                {a.attachmentUrl && (
                  <a href={a.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <CheckCircle2 className="h-4 w-4" /> Download attachment
                  </a>
                )}
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{a.author?.name ?? "School"}</span>
                  <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {formatRelativeTime(a.createdAt)}</span>
                  {a.expiresAt && !a.isExpired && (
                    <span className="flex items-center gap-1">Expires {formatDate(a.expiresAt)}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Compose / edit dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Announcement" : "New Announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Inter-house sports rescheduled" />
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write the announcement…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Entire School</SelectItem>
                    <SelectItem value="TEACHERS">Teachers</SelectItem>
                    <SelectItem value="PARENTS">Parents</SelectItem>
                    <SelectItem value="STUDENTS">Students</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="CLASS">Specific Class</SelectItem>
                    <SelectItem value="DEPARTMENT">Department</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {audience === "CLASS" && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> Class</Label>
                <Select value={targetClassId} onValueChange={setTargetClassId}>
                  <SelectTrigger><SelectValue placeholder="Select class…" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {audience === "DEPARTMENT" && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Department</Label>
                <Select value={targetDepartmentId} onValueChange={setTargetDepartmentId}>
                  <SelectTrigger><SelectValue placeholder="Select department…" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Expires (optional)</Label>
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Pin to top</Label>
                <Button
                  type="button"
                  variant={pinned ? "gradient" : "outline"}
                  className="w-full"
                  onClick={() => setPinned(!pinned)}
                >
                  <Pin className="mr-1 h-4 w-4" /> {pinned ? "Pinned" : "Not pinned"}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setComposeOpen(false); resetForm(); }}>Cancel</Button>
            <Button variant="gradient" onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
              {editing ? "Update" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
