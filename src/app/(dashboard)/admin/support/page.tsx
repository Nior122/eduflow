"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, LifeBuoy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/support/tickets")
      .then((r) => parseJsonBody(r))
      .then((d) => setTickets(d.tickets ?? []))
      .catch(() => toast({ title: "Failed to load tickets", variant: "destructive" }));

  useEffect(() => {
    load();
  }, []);

  const open = async () => {
    if (!subject.trim() || !description.trim()) {
      toast({ title: "Subject and description are required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, description, priority }),
      });
      if (!res.ok) throw new Error("failed");
      setSubject("");
      setDescription("");
      await load();
      toast({ title: "Ticket opened — our team will reply by email" });
    } catch {
      toast({ title: "Failed to open ticket", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="text-sm text-muted-foreground">Tickets are answered by the EduFlow platform team.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" /> Open a ticket
          </CardTitle>
          <CardDescription>Include steps to reproduce and any affected modules.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. AI report comments stopped working" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened? What did you expect?" />
          </div>
          <div className="flex items-center gap-3">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => void open()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Submit ticket
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your tickets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tickets.length === 0 && <p className="text-sm text-muted-foreground">No tickets yet</p>}
          {tickets.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">{t.subject}</div>
                <div className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">{t.priority}</Badge>
                <Badge variant="outline">{t.status}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
