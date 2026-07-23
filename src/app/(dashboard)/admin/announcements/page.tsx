"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Megaphone, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";

type Announcement = {
  id: string; title: string; content: string; priority: string; audience: string; createdAt: string;
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", priority: "NORMAL", audience: "ALL" });

  useEffect(() => {
    fetch("/api/admin/announcements")
      .then(r => r.ok && r.json())
      .then(d => { if (d?.announcements) setAnnouncements(d.announcements); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.title || !form.content) return toast({ title: "Title and content required", variant: "destructive" });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      toast({ title: "Announcement published", variant: "success" });
      setDialogOpen(false);
      setForm({ title: "", content: "", priority: "NORMAL", audience: "ALL" });
      fetch("/api/admin/announcements").then(r => r.json()).then(d => d?.announcements && setAnnouncements(d.announcements));
    } catch { toast({ title: "Failed to publish", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const priorityColor = (p: string) => p === "URGENT" ? "destructive" : p === "HIGH" ? "warning" : "default";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Announcements</h2><p className="text-muted-foreground">Send announcements to students, parents, and staff</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button variant="gradient"><Plus className="mr-2 h-4 w-4" /> New Announcement</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Announcement</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div className="space-y-2"><Label>Content</Label><Textarea rows={4} value={form.content} onChange={e => setForm({...form, content: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Priority</Label><Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="URGENT">Urgent</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Audience</Label><Select value={form.audience} onValueChange={v => setForm({...form, audience: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Everyone</SelectItem><SelectItem value="TEACHERS">Teachers Only</SelectItem><SelectItem value="PARENTS">Parents Only</SelectItem><SelectItem value="STUDENTS">Students Only</SelectItem></SelectContent></Select></div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing...</> : "Publish"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {loading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />) : 
         announcements.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><Megaphone className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No announcements yet</p></CardContent></Card>
         ) : announcements.map(a => (
          <Card key={a.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Badge variant={priorityColor(a.priority) as "default" | "destructive" | "warning" | undefined}>{a.priority}</Badge><CardTitle className="text-base">{a.title}</CardTitle></div>
                <span className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
              <div className="mt-2"><Badge variant="secondary" className="text-xs">{a.audience}</Badge></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
