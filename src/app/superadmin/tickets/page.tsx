"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  school: { name: string; slug: string } | null;
  createdBy: { name: string | null; email: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  PENDING: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-700",
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const load = (status = filter) => {
    setLoading(true);
    fetch(`/api/superadmin/tickets?status=${status}`)
      .then((r) => r.json())
      .then((d) => setTickets(d.tickets ?? []))
      .catch(() => toast({ title: "Failed to load tickets", variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load("ALL");
  }, []);

  const update = async (t: Ticket, data: Record<string, string>) => {
    const res = await fetch(`/api/superadmin/tickets/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) load();
    else toast({ title: "Update failed", variant: "destructive" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Support tickets ({tickets.length})</h1>
        <Select value={filter} onValueChange={(v) => { setFilter(v); load(v); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["ALL", "OPEN", "PENDING", "RESOLVED", "CLOSED"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && <Skeleton className="h-64 w-full" />}
      <div className="space-y-3">
        {!loading &&
          tickets.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{t.subject}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_STYLE[t.status] ?? ""}>{t.status}</Badge>
                    <Badge variant="secondary">{t.priority}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.school?.name ?? "No school"} · {t.createdBy?.email ?? "unknown"} ·{" "}
                  {new Date(t.createdAt).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap">{t.description}</p>
                <div className="flex flex-wrap gap-2">
                  {["OPEN", "PENDING", "RESOLVED", "CLOSED"].map((s) => (
                    <Button key={s} size="sm" variant={t.status === s ? "default" : "outline"} onClick={() => void update(t, { status: s })}>
                      {s}
                    </Button>
                  ))}
                  {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                    <Button key={p} size="sm" variant="ghost" onClick={() => void update(t, { priority: p })}>
                      {p}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        {!loading && tickets.length === 0 && (
          <p className="py-16 text-center text-muted-foreground">No tickets in this view</p>
        )}
      </div>
    </div>
  );
}
