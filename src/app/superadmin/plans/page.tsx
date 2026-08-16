"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type Plan = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  features: Record<string, unknown>;
};

const EMPTY = {
  name: "",
  code: "",
  description: "",
  priceMonthly: "2900",
  priceYearly: "29000",
  currency: "USD",
  sortOrder: "5",
  maxStudents: "100",
  maxTeachers: "10",
  storageMb: "1024",
  aiTokensPerMonth: "100000",
  apiCallsPerMonth: "10000",
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/superadmin/plans")
      .then((r) => r.json())
      .then((d) => setPlans(d.plans ?? []));

  useEffect(() => {
    load().catch(() => toast({ title: "Failed to load plans", variant: "destructive" }));
  }, []);

  const save = async () => {
    if (!form.name || !form.code) {
      toast({ title: "Name and code are required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/superadmin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          description: form.description || null,
          priceMonthly: Number(form.priceMonthly),
          priceYearly: Number(form.priceYearly),
          currency: form.currency,
          sortOrder: Number(form.sortOrder),
          features: {
            maxStudents: Number(form.maxStudents),
            maxTeachers: Number(form.maxTeachers),
            storageMb: Number(form.storageMb),
            aiTokensPerMonth: Number(form.aiTokensPerMonth),
            apiCallsPerMonth: Number(form.apiCallsPerMonth),
            modules: {},
          },
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setForm(EMPTY);
      await load();
      toast({ title: "Plan saved" });
    } catch {
      toast({ title: "Failed to save plan", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: Plan) => {
    await fetch(`/api/superadmin/plans/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    await load();
  };

  const remove = async (p: Plan) => {
    if (!confirm(`Delete plan ${p.name}?`)) return;
    const res = await fetch(`/api/superadmin/plans/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast({ title: d.error ?? "Delete failed", variant: "destructive" });
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Subscription plans</h1>

      <Card>
        <CardHeader>
          <CardTitle>New / update plan (upsert by code)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Starter" /></div>
          <div className="space-y-2"><Label>Code (unique)</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="STARTER" /></div>
          <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-2"><Label>Monthly price (minor units)</Label><Input type="number" value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })} /></div>
          <div className="space-y-2"><Label>Yearly price (minor units)</Label><Input type="number" value={form.priceYearly} onChange={(e) => setForm({ ...form, priceYearly: e.target.value })} /></div>
          <div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></div>
          <div className="space-y-2"><Label>Sort order</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></div>
          <div className="space-y-2"><Label>Max students</Label><Input type="number" value={form.maxStudents} onChange={(e) => setForm({ ...form, maxStudents: e.target.value })} /></div>
          <div className="space-y-2"><Label>Max teachers</Label><Input type="number" value={form.maxTeachers} onChange={(e) => setForm({ ...form, maxTeachers: e.target.value })} /></div>
          <div className="space-y-2"><Label>Storage (MB)</Label><Input type="number" value={form.storageMb} onChange={(e) => setForm({ ...form, storageMb: e.target.value })} /></div>
          <div className="space-y-2"><Label>AI tokens / month</Label><Input type="number" value={form.aiTokensPerMonth} onChange={(e) => setForm({ ...form, aiTokensPerMonth: e.target.value })} /></div>
          <div className="space-y-2"><Label>API calls / month</Label><Input type="number" value={form.apiCallsPerMonth} onChange={(e) => setForm({ ...form, apiCallsPerMonth: e.target.value })} /></div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Save plan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Yearly</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.code}</div>
                  </TableCell>
                  <TableCell>{(p.priceMonthly / 100).toFixed(2)} {p.currency}</TableCell>
                  <TableCell>{(p.priceYearly / 100).toFixed(2)} {p.currency}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {String(p.features?.maxStudents ?? "?")} students · {String(p.features?.maxTeachers ?? "?")} teachers
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? "default" : "outline"}>{p.isActive ? "active" : "inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => void toggleActive(p)}>
                        {p.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void remove(p)}>
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
