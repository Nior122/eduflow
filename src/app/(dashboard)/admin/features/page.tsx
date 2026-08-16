"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type FeatureData = {
  planCode: string | null;
  planDefaults: Record<string, boolean>;
  overrides: { module: string; enabled: boolean }[];
  effective: Record<string, boolean>;
};

const MODULE_LABELS: Record<string, string> = {
  LIBRARY: "Library",
  TRANSPORT: "Transport",
  PAYROLL: "Payroll",
  AI: "AI Assistant",
  HOSTEL: "Hostel",
  CLINIC: "Clinic",
  INVENTORY: "Inventory",
  CERTIFICATES: "Certificates",
  MESSAGING: "Messaging",
  REPORTS: "Reports",
  BILLING: "Billing & Fees",
};

export default function FeaturesPage() {
  const [data, setData] = useState<FeatureData | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/feature-flags")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast({ title: "Failed to load features", variant: "destructive" }));
  }, []);

  const toggle = async (module: string, enabled: boolean) => {
    setPending(module);
    try {
      const res = await fetch("/api/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, enabled }),
      });
      if (!res.ok) throw new Error("update failed");
      const next = await fetch("/api/feature-flags").then((r) => r.json());
      setData(next);
    } catch {
      toast({ title: "Failed to update feature", variant: "destructive" });
    } finally {
      setPending(null);
    }
  };

  if (!data) return <Skeleton className="h-64 w-full" />;

  const modules = Object.keys(MODULE_LABELS);
  const overridden = new Set(data.overrides.map((o) => o.module));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feature Modules</h1>
        <p className="text-sm text-muted-foreground">
          Availability comes from your plan ({data.planCode ?? "—"}). You can enable/disable modules for
          your school — modules not included in your plan stay off unless the plan allows them.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
          <CardDescription>
            {overridden.size > 0
              ? `${overridden.size} override(s) active — marked with a dot`
              : "No overrides yet — defaults come from your plan"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {modules.map((m) => {
            const effective = data.effective[m] === true;
            const planDefault = data.planDefaults[m] === true;
            const isOverride = overridden.has(m);
            return (
              <div key={m} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {MODULE_LABELS[m]}
                    {isOverride && <Badge variant="secondary">overridden</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Plan default: {planDefault ? "included" : "not included"}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  {pending === m && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Checkbox
                    checked={effective}
                    onCheckedChange={(v) => void toggle(m, v === true)}
                  />
                  {effective ? "On" : "Off"}
                </label>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
