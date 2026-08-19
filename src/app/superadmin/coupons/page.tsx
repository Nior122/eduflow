"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  currency: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  validUntil: string | null;
  isActive: boolean;
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState({ code: "", description: "", discountType: "PERCENT", discountValue: "10", maxRedemptions: "" });
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/superadmin/coupons")
      .then((r) => parseJsonBody(r))
      .then((d) => setCoupons(d.coupons ?? []));

  useEffect(() => {
    load().catch(() => toast({ title: "Failed to load coupons", variant: "destructive" }));
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/superadmin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          description: form.description || null,
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
        }),
      });
      const d = await parseJsonBody(res);
      if (!res.ok) throw new Error(d.error ?? "Create failed");
      setForm({ code: "", description: "", discountType: "PERCENT", discountValue: "10", maxRedemptions: "" });
      await load();
      toast({ title: "Coupon created" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Create failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c: Coupon) => {
    await fetch(`/api/superadmin/coupons/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    await load();
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    await fetch(`/api/superadmin/coupons/${c.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Coupons</h1>

      <Card>
        <CardHeader>
          <CardTitle>New coupon</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2"><Label>Code</Label><Input placeholder="LAUNCH20" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
          <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Type</Label>
            <select className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
              <option value="PERCENT">Percent</option>
              <option value="FIXED">Fixed (minor units)</option>
            </select>
          </div>
          <div className="space-y-2"><Label>Value</Label><Input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} /></div>
          <div className="space-y-2"><Label>Max redemptions (optional)</Label><Input type="number" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} /></div>
          <div className="flex items-end">
            <Button onClick={() => void create()} disabled={busy || !form.code}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Redemptions</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-mono font-medium">{c.code}</span>
                    {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                  </TableCell>
                  <TableCell>
                    {c.discountType === "PERCENT" ? `${c.discountValue}%` : `${(c.discountValue / 100).toFixed(2)} ${c.currency ?? ""}`}
                  </TableCell>
                  <TableCell>{c.redemptionCount}{c.maxRedemptions !== null ? ` / ${c.maxRedemptions}` : ""}</TableCell>
                  <TableCell className="text-xs">{c.validUntil ? new Date(c.validUntil).toLocaleDateString() : "never"}</TableCell>
                  <TableCell><Badge variant={c.isActive ? "default" : "outline"}>{c.isActive ? "active" : "disabled"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => void toggle(c)}>{c.isActive ? "Disable" : "Enable"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => void remove(c)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {coupons.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No coupons</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
