"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { WEBHOOK_EVENTS } from "@/lib/saas/events";

type EndpointRow = {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
};

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<EndpointRow[]>([]);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<string[]>([...WEBHOOK_EVENTS]);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/admin/webhooks")
      .then((r) => r.json())
      .then((d) => setEndpoints(d.endpoints ?? []));

  useEffect(() => {
    load().catch(() => toast({ title: "Failed to load webhooks", variant: "destructive" }));
  }, []);

  const toggleEvent = (e: string) =>
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const create = async () => {
    if (!/^https:\/\//.test(url)) {
      toast({ title: "URL must start with https://", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, secret: secret || undefined, events }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Create failed");
      setUrl("");
      setSecret("");
      await load();
      toast({ title: "Webhook created — a verification ping was queued" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Create failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row: EndpointRow) => {
    await fetch(`/api/admin/webhooks/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this webhook endpoint?")) return;
    await fetch(`/api/admin/webhooks/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <p className="text-sm text-muted-foreground">
          Receive real-time events (students created, payments received…) as signed POSTs to your
          endpoint. Signature: <code>X-EduFlow-Signature</code> = HMAC-SHA256 of the raw body with your secret.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New endpoint</CardTitle>
          <CardDescription>Deliveries are retried with exponential backoff (max 5 attempts).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Endpoint URL</Label>
              <Input id="webhookUrl" placeholder="https://your-app.example.com/hooks/eduflow" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhookSecret">Signing secret (optional)</Label>
              <Input id="webhookSecret" placeholder="random string" value={secret} onChange={(e) => setSecret(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Events</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {WEBHOOK_EVENTS.map((e) => (
                <label key={e} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={events.includes(e)} onCheckedChange={() => toggleEvent(e)} />
                  <span className="font-mono text-xs">{e}</span>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={() => void create()} disabled={busy || !url}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Create endpoint
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">No endpoints yet</TableCell>
                </TableRow>
              )}
              {endpoints.map((ep) => (
                <TableRow key={ep.id}>
                  <TableCell className="max-w-[280px] truncate font-mono text-xs">{ep.url}</TableCell>
                  <TableCell className="max-w-[220px]">
                    <div className="flex flex-wrap gap-1">
                      {(ep.events.length ? ep.events : ["*"]).slice(0, 4).map((e) => (
                        <Badge key={e} variant="secondary" className="font-mono text-[10px]">{e}</Badge>
                      ))}
                      {ep.events.length > 4 && <Badge variant="outline" className="text-[10px]">+{ep.events.length - 4}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ep.isActive ? "default" : "outline"}>{ep.isActive ? "active" : "paused"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => void toggle(ep)}>
                        {ep.isActive ? "Pause" : "Resume"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void remove(ep.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
