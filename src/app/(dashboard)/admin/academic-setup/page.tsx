"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CalendarRange, ClipboardCheck, Loader2, Lock, Archive, Play } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

type Session = {
  id: string; name: string; startDate: string | null; endDate: string | null;
  isActive: boolean; isLocked: boolean; isArchived: boolean;
  terms: { id: string; name: string; isActive: boolean; startDate: string | null; endDate: string | null }[];
};

export default function AcademicSetupPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionDialog, setSessionDialog] = useState(false);
  const [termDialog, setTermDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessionForm, setSessionForm] = useState({ name: "", startDate: "", endDate: "" });
  const [termForm, setTermForm] = useState({ sessionId: "", name: "FIRST", startDate: "", endDate: "" });

  const load = () =>
    fetch("/api/admin/sessions")
      .then((r) => r.ok && r.json())
      .then((d) => d?.sessions && setSessions(d.sessions))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleCreateSession = async () => {
    if (!sessionForm.name) return toast({ title: "Session name required", variant: "destructive" });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sessionForm),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Session created", variant: "success" });
      setSessionDialog(false);
      setSessionForm({ name: "", startDate: "", endDate: "" });
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to create session", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSessionAction = async (session: Session, patch: Record<string, boolean>) => {
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Session updated", variant: "success" });
      load();
    } catch {
      toast({ title: "Failed to update session", variant: "destructive" });
    }
  };

  const handleCreateTerm = async () => {
    if (!termForm.sessionId) return toast({ title: "Select a session", variant: "destructive" });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/terms", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(termForm),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Term created", variant: "success" });
      setTermDialog(false);
      setTermForm({ sessionId: "", name: "FIRST", startDate: "", endDate: "" });
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to create term", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleActivateTerm = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/terms/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Term activated", variant: "success" });
      load();
    } catch {
      toast({ title: "Failed to activate term", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Academic Setup</h2>
        <p className="text-muted-foreground">Manage academic sessions and terms</p>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="terms">Terms</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={sessionDialog} onOpenChange={setSessionDialog}>
              <DialogTrigger asChild>
                <Button variant="gradient"><Plus className="mr-2 h-4 w-4" /> New Session</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Academic Session</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2"><Label>Session Name *</Label><Input value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })} placeholder="e.g. 2026/2027" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={sessionForm.startDate} onChange={(e) => setSessionForm({ ...sessionForm, startDate: e.target.value })} /></div>
                    <div className="space-y-2"><Label>End Date</Label><Input type="date" value={sessionForm.endDate} onChange={(e) => setSessionForm({ ...sessionForm, endDate: e.target.value })} /></div>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setSessionDialog(false)}>Cancel</Button>
                  <Button onClick={handleCreateSession} disabled={saving}>
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Create Session"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead className="hidden md:table-cell">Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Terms</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell><Skeleton className="h-8 w-32" /></TableCell><TableCell><Skeleton className="h-8 w-48" /></TableCell><TableCell><Skeleton className="h-8 w-20" /></TableCell><TableCell><Skeleton className="h-8 w-32" /></TableCell><TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell></TableRow>
                  )) : sessions.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12">
                      <CalendarRange className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No sessions yet</p>
                    </TableCell></TableRow>
                  ) : sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {s.startDate ? formatDate(s.startDate) : "—"} → {s.endDate ? formatDate(s.endDate) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.isActive && <Badge variant="success">Active</Badge>}
                          {s.isLocked && <Badge variant="warning">Locked</Badge>}
                          {s.isArchived && <Badge>Archived</Badge>}
                          {!s.isActive && !s.isLocked && !s.isArchived && <Badge variant="outline">Planned</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {s.terms.map((t) => (
                            <Badge key={t.id} variant={t.isActive ? "success" : "secondary"} className="text-xs">{t.name}</Badge>
                          ))}
                          {s.terms.length === 0 && <span className="text-xs text-muted-foreground">No terms</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!s.isActive && !s.isArchived && (
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSessionAction(s, { isActive: true })}>
                              <Play className="mr-1 h-3 w-3" /> Activate
                            </Button>
                          )}
                          {!s.isLocked && (
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSessionAction(s, { isLocked: true })}>
                              <Lock className="mr-1 h-3 w-3" /> Lock
                            </Button>
                          )}
                          {!s.isArchived && (
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSessionAction(s, { isArchived: true, isActive: false })}>
                              <Archive className="mr-1 h-3 w-3" /> Archive
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={termDialog} onOpenChange={setTermDialog}>
              <DialogTrigger asChild>
                <Button variant="gradient"><Plus className="mr-2 h-4 w-4" /> New Term</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Academic Term</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Session *</Label>
                    <Select value={termForm.sessionId} onValueChange={(v) => setTermForm({ ...termForm, sessionId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                      <SelectContent>
                        {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Term *</Label>
                    <Select value={termForm.name} onValueChange={(v) => setTermForm({ ...termForm, name: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIRST">First Term</SelectItem>
                        <SelectItem value="SECOND">Second Term</SelectItem>
                        <SelectItem value="THIRD">Third Term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={termForm.startDate} onChange={(e) => setTermForm({ ...termForm, startDate: e.target.value })} /></div>
                    <div className="space-y-2"><Label>End Date</Label><Input type="date" value={termForm.endDate} onChange={(e) => setTermForm({ ...termForm, endDate: e.target.value })} /></div>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setTermDialog(false)}>Cancel</Button>
                  <Button onClick={handleCreateTerm} disabled={saving}>
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Create Term"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {sessions.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <ClipboardCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Create a session first, then add terms to it.</p>
            </CardContent></Card>
          ) : sessions.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {s.terms.length === 0 ? (
                      <TableRow><TableCell className="text-center py-6 text-muted-foreground">No terms for this session</TableCell></TableRow>
                    ) : s.terms.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name} Term</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {t.startDate ? formatDate(t.startDate) : "—"} → {t.endDate ? formatDate(t.endDate) : "—"}
                        </TableCell>
                        <TableCell>{t.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                        <TableCell className="text-right">
                          {!t.isActive && (
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleActivateTerm(t.id)}>
                              <Play className="mr-1 h-3 w-3" /> Activate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
