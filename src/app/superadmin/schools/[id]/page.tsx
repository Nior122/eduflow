"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Detail = {
  school: {
    id: string;
    name: string;
    slug: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    website: string | null;
    status: string;
    onboardingComplete: boolean;
    createdAt: string;
    subscription: {
      id: string;
      status: string;
      cycle: string;
      trialEndsAt: string | null;
      cancelAtPeriodEnd: boolean;
      billingEmail: string | null;
      amountMinor: number;
      currency: string;
      plan: { id: string; name: string; code: string; priceMonthly: number; priceYearly: number };
    } | null;
  };
  usageRows: { metric: string; period: string; value: number }[];
  invoices: { id: string; number: string; status: string; amountMinor: number; currency: string; createdAt: string }[];
  tickets: { id: string; subject: string; status: string; priority: string; createdAt: string }[];
  users: { id: string; name: string | null; email: string; role: string; isActive: boolean }[];
};

export default function SchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [plans, setPlans] = useState<{ id: string; name: string; code: string }[]>([]);
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`/api/superadmin/schools/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setPlanId(d.school.subscription?.plan.id ?? "");
      });

  useEffect(() => {
    load().catch(() => toast({ title: "Failed to load school", variant: "destructive" }));
    fetch("/api/superadmin/plans")
      .then((r) => r.json())
      .then((d) => setPlans(d.plans ?? []))
      .catch(() => {});
  }, [params.id]);

  const changePlan = async () => {
    if (!planId) return;
    setBusy(true);
    const res = await fetch(`/api/superadmin/schools/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    if (res.ok) {
      toast({ title: "Plan changed" });
      await load();
    } else {
      toast({ title: "Failed to change plan", variant: "destructive" });
    }
    setBusy(false);
  };

  const toggleSuspend = async () => {
    const next = data?.school.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    const res = await fetch("/api/superadmin/schools", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: params.id, status: next }),
    });
    if (res.ok) {
      toast({ title: next === "SUSPENDED" ? "School suspended" : "School activated" });
      await load();
    }
  };

  if (!data) return <Skeleton className="h-96 w-full" />;
  const s = data.school;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/superadmin/schools")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> All schools
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{s.name}</h1>
          <p className="text-sm text-muted-foreground">
            {s.slug} · created {new Date(s.createdAt).toLocaleDateString()} ·{" "}
            {s.email ?? "no email"} {s.phone ? `· ${s.phone}` : ""}
          </p>
        </div>
        <Button variant={s.status === "SUSPENDED" ? "default" : "outline"} onClick={() => void toggleSuspend()}>
          {s.status === "SUSPENDED" ? "Activate school" : "Suspend school"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              {s.subscription
                ? `${s.subscription.plan.name} (${s.subscription.cycle}) · ${(s.subscription.amountMinor / 100).toFixed(2)} ${s.subscription.currency} · billing ${s.subscription.billingEmail ?? "—"}`
                : "No subscription"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{s.subscription?.status ?? "NONE"}</Badge>
              {s.subscription?.trialEndsAt && (
                <span className="text-xs text-muted-foreground">
                  trial ends {new Date(s.subscription.trialEndsAt).toLocaleDateString()}
                </span>
              )}
              {s.subscription?.cancelAtPeriodEnd && <Badge variant="outline">cancels at period end</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Change plan…" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => void changePlan()} disabled={busy || !planId}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Invoice</TableHead><TableHead>Status</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.slice(0, 8).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                    <TableCell><Badge variant="outline">{inv.status}</Badge></TableCell>
                    <TableCell>{(inv.amountMinor / 100).toFixed(2)} {inv.currency}</TableCell>
                    <TableCell className="text-xs">{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {data.invoices.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No invoices</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Users ({data.users.length})</CardTitle>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{u.email}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{u.role}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage (current period)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {data.usageRows.length === 0 && <p className="text-sm text-muted-foreground">No usage recorded yet</p>}
              {data.usageRows.slice(0, 12).map((u) => (
                <Badge key={u.metric + u.period} variant="secondary">
                  {u.metric}: {u.value.toLocaleString()} ({u.period})
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tickets ({data.tickets.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.tickets.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <span className="truncate">{t.subject}</span>
                  <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                </div>
              ))}
              {data.tickets.length === 0 && <p className="text-sm text-muted-foreground">No tickets</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
