"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, CreditCard, Loader2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type SubscriptionData = {
  subscription: {
    status: string;
    cycle: string;
    trialEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    billingEmail: string | null;
    plan: { name: string; code: string; priceMonthly: number; priceYearly: number; currency: string };
  } | null;
  school: { name: string; email: string | null };
  plans: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
  }[];
  recentInvoices: {
    id: string;
    number: string;
    status: string;
    amountMinor: number;
    currency: string;
    paidAt: string | null;
    createdAt: string;
  }[];
};

type UsageData = {
  planCode: string | null;
  limits: { maxStudents: number; maxTeachers: number; storageMb: number; aiTokensPerMonth: number; apiCallsPerMonth: number };
  usage: { students: number; teachers: number; apiCalls: number; storageKb: number; aiTokens: number; aiCostUsd: number };
};

const STATUS_STYLE: Record<string, string> = {
  TRIALING: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-green-100 text-green-800",
  PAST_DUE: "bg-amber-100 text-amber-800",
  CANCELED: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-700",
};

export default function SubscriptionPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/subscription").then((r) => r.json()),
      fetch("/api/billing/usage").then((r) => r.json()),
    ])
      .then(([d, u]) => {
        setData(d);
        setUsage(u);
      })
      .catch(() => toast({ title: "Failed to load subscription", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const choosePlan = async (planCode: string, couponCode?: string) => {
    setBusy(planCode);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, cycle, couponCode }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Checkout failed");
      window.location.href = d.checkoutUrl;
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Checkout failed", variant: "destructive" });
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!confirm("Cancel at the end of the current billing period?")) return;
    setBusy("cancel");
    const res = await fetch("/api/billing/subscription/cancel", { method: "POST" });
    if (res.ok) {
      toast({ title: "Cancellation scheduled" });
      window.location.reload();
    } else {
      toast({ title: "Cancellation failed", variant: "destructive" });
      setBusy(null);
    }
  };

  const reactivate = async () => {
    setBusy("reactivate");
    const res = await fetch("/api/billing/subscription/reactivate", { method: "POST" });
    if (res.ok) {
      toast({ title: "Subscription reactivated" });
      window.location.reload();
    } else {
      toast({ title: "Reactivation failed", variant: "destructive" });
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!data) return null;

  const sub = data.subscription;
  const meters: { label: string; used: number; limit: number; unit: string }[] = usage
    ? [
        { label: "Students", used: usage.usage.students, limit: usage.limits.maxStudents, unit: "" },
        { label: "Teachers", used: usage.usage.teachers, limit: usage.limits.maxTeachers, unit: "" },
        { label: "API calls / mo", used: usage.usage.apiCalls, limit: usage.limits.apiCallsPerMonth, unit: "" },
        { label: "AI tokens / mo", used: usage.usage.aiTokens, limit: usage.limits.aiTokensPerMonth, unit: "" },
        { label: "Storage", used: Math.round(usage.usage.storageKb / 1024), limit: usage.limits.storageMb, unit: " MB" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Subscription</h1>
          <p className="text-sm text-muted-foreground">
            {data.school.name} · billing email: {sub?.billingEmail ?? data.school.email ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["MONTHLY", "YEARLY"].map((c) => (
            <Button key={c} size="sm" variant={cycle === c ? "default" : "outline"} onClick={() => setCycle(c as "MONTHLY" | "YEARLY")}>
              {c === "YEARLY" ? "Yearly (−2 months free)" : "Monthly"}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan: {sub?.plan.name ?? "None"}
            {sub && (
              <Badge className={STATUS_STYLE[sub.status] ?? ""}>{sub.status}</Badge>
            )}
            {sub?.cancelAtPeriodEnd && <Badge variant="outline">Cancels at period end</Badge>}
          </CardTitle>
          <CardDescription>
            {sub?.status === "TRIALING" && sub.trialEndsAt
              ? `Trial ends ${new Date(sub.trialEndsAt).toLocaleDateString()} — choose a plan to keep your school active.`
              : sub?.currentPeriodEnd
                ? `Current period ends ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                : "No active subscription yet."}
          </CardDescription>
        </CardHeader>
        {sub && (
          <CardContent className="flex gap-2">
            {sub.cancelAtPeriodEnd ? (
              <Button size="sm" onClick={() => void reactivate()} disabled={busy !== null}>
                {busy === "reactivate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Reactivate
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void cancel()} disabled={busy !== null}>
                {busy === "cancel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Cancel at period end
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage this month</CardTitle>
          <CardDescription>Against your plan limits ({usage?.planCode ?? "—"}).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meters.map((m) => {
            const pct = m.limit > 0 ? Math.min(100, Math.round((m.used / m.limit) * 100)) : 0;
            return (
              <div key={m.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>{m.label}</span>
                  <span className="text-muted-foreground">
                    {m.used.toLocaleString()}{m.unit} / {m.limit.toLocaleString()}{m.unit}
                  </span>
                </div>
                <Progress value={pct} className={pct >= 100 ? "bg-red-100" : undefined} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {data.plans.map((p) => {
          const current = sub?.plan.code === p.code;
          const price = cycle === "MONTHLY" ? p.priceMonthly : p.priceYearly;
          return (
            <Card key={p.id} className={current ? "ring-2 ring-primary" : undefined}>
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-bold">
                  {(price / 100).toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{p.currency}/{cycle.toLowerCase()}</span>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" /> All core modules</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" /> Email support</li>
                </ul>
                <Button
                  className="w-full"
                  variant={current ? "outline" : "default"}
                  disabled={current || busy !== null}
                  onClick={() => void choosePlan(p.code)}
                >
                  {current ? "Current plan" : busy === p.code ? <Loader2 className="h-4 w-4 animate-spin" /> : "Choose plan"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentInvoices.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No invoices yet</TableCell></TableRow>
              )}
              {data.recentInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "PAID" ? "default" : "outline"}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell>{(inv.amountMinor / 100).toFixed(2)} {inv.currency}</TableCell>
                  <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : <X className="h-4 w-4 text-muted-foreground" />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
