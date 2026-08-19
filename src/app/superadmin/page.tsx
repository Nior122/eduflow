"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, DollarSign, Users, Ticket, Activity, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type DashboardData = {
  stats: {
    totalSchools: number;
    newSchools: number;
    activeSubscriptions: number;
    trialing: number;
    pastDue: number;
    canceled: number;
    mrrMinor: number;
    totalUsers: number;
    storageMb: number;
    aiTokens: number;
    aiCostUsd: number;
    openTickets: number;
    dbHealthy: boolean;
  };
  recentSchools: { id: string; name: string; slug: string; createdAt: string }[];
};

export default function SuperAdminOverview() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/superadmin/dashboard")
      .then((r) => parseJsonBody(r))
      .then(setData)
      .catch(() => toast({ title: "Failed to load dashboard", variant: "destructive" }));
  }, []);

  if (!data) return <Skeleton className="h-64 w-full" />;

  const cards = [
    { label: "Registered schools", value: data.stats.totalSchools, sub: `+${data.stats.newSchools} this month`, icon: Building2 },
    { label: "MRR (active)", value: `${(data.stats.mrrMinor / 100).toFixed(2)}`, sub: `${data.stats.activeSubscriptions} active subs`, icon: DollarSign },
    { label: "Active users", value: data.stats.totalUsers, sub: "excl. platform admins", icon: Users },
    { label: "Open tickets", value: data.stats.openTickets, sub: `${data.stats.trialing} trialing · ${data.stats.pastDue} past due`, icon: Ticket },
    { label: "AI usage (all time)", value: `${(data.stats.aiCostUsd ?? 0).toFixed(2)} USD`, sub: `${(data.stats.aiTokens ?? 0).toLocaleString()} tokens`, icon: Activity },
    { label: "Storage (this month)", value: `${data.stats.storageMb} MB`, sub: "across tenants", icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Platform overview</h1>
        <Badge variant={data.stats.dbHealthy ? "default" : "destructive"}>
          {data.stats.dbHealthy ? "Database healthy" : "Database unreachable"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <c.icon className="h-4 w-4" /> {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent registrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentSchools.map((s) => (
            <Link key={s.id} href={`/superadmin/schools/${s.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.slug}</div>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</div>
            </Link>
          ))}
          {data.recentSchools.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> No schools yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
