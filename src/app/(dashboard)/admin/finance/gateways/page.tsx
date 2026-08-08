"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, Lock } from "lucide-react";

type GatewayConfig = {
  id: string;
  gateway: string;
  isActive: boolean;
  publicKey: string | null;
  secretKey: string | null;
  webhookSecret: string | null;
  testMode: boolean;
};

const GATEWAY_META: Record<string, { label: string; description: string; currencies: string }> = {
  paystack: { label: "Paystack", description: "NGN, GHS, ZAR, USD · cards, bank transfer, USSD, mobile money", currencies: "NGN · GHS · ZAR · USD" },
  flutterwave: { label: "Flutterwave", description: "NGN, GHS, KES, USD · cards, bank, mobile money", currencies: "NGN · GHS · KES · USD" },
  stripe: { label: "Stripe", description: "USD, EUR, GBP · cards, Apple/Google Pay", currencies: "USD · EUR · GBP" },
};

export default function GatewaysPage() {
  const [configs, setConfigs] = useState<GatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { publicKey: string; secretKey: string; webhookSecret: string; testMode: boolean; isActive: boolean }>>({});

  useEffect(() => {
    fetch("/api/finance/gateways")
      .then((r) => r.json())
      .then((d) => {
        const rows = d.gateways ?? [];
        setConfigs(rows);
        const f: Record<string, { publicKey: string; secretKey: string; webhookSecret: string; testMode: boolean; isActive: boolean }> = {};
        for (const g of ["paystack", "flutterwave", "stripe"]) {
          const row = rows.find((r: GatewayConfig) => r.gateway === g);
          f[g] = {
            publicKey: row?.publicKey ?? "",
            secretKey: row?.secretKey ?? "",
            webhookSecret: row?.webhookSecret ?? "",
            testMode: row?.testMode ?? true,
            isActive: row?.isActive ?? false,
          };
        }
        setForms(f);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (gateway: string) => {
    const f = forms[gateway];
    setSaving(gateway);
    try {
      const res = await fetch("/api/finance/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway,
          publicKey: f.publicKey || undefined,
          secretKey: f.secretKey || undefined,
          webhookSecret: f.webhookSecret || undefined,
          testMode: f.testMode,
          isActive: f.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: `${GATEWAY_META[gateway].label} configuration saved` });
      const res2 = await fetch("/api/finance/gateways");
      const d2 = await res2.json();
      setConfigs(d2.gateways ?? []);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const update = (gateway: string, patch: Partial<typeof forms[string]>) => {
    setForms((prev) => ({ ...prev, [gateway]: { ...prev[gateway], ...patch } }));
  };

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Payment Gateways</h2>
        <p className="text-sm text-muted-foreground">
          Architecture-ready abstraction layer — no provider is hardcoded. Save keys here, activate one gateway, and
          <span className="font-mono text-xs"> POST /api/finance/payments/initialize</span> routes through it.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Object.entries(GATEWAY_META).map(([key, meta]) => {
          const f = forms[key];
          const active = configs.find((c) => c.gateway === key)?.isActive ?? false;
          return (
            <Card key={key} className={active ? "border-green-500/60" : ""}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{meta.label}</CardTitle>
                {active ? <Badge variant="success">ACTIVE</Badge> : <Badge variant="secondary">Inactive</Badge>}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{meta.description}</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Public key</Label>
                  <Input value={f?.publicKey ?? ""} onChange={(e) => update(key, { publicKey: e.target.value })} placeholder="pk_…" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Lock className="h-3 w-3" /> Secret key</Label>
                  <Input type="password" value={f?.secretKey ?? ""} onChange={(e) => update(key, { secretKey: e.target.value })} placeholder="sk_…" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Webhook secret (optional)</Label>
                  <Input value={f?.webhookSecret ?? ""} onChange={(e) => update(key, { webhookSecret: e.target.value })} />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={f?.testMode ?? true} onChange={(e) => update(key, { testMode: e.target.checked })} />
                    Test mode
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={f?.isActive ?? false} onChange={(e) => update(key, { isActive: e.target.checked })} />
                    Active
                  </label>
                </div>
                <Button className="w-full" onClick={() => save(key)} disabled={saving === key}>
                  {saving === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                  {saving === key ? "Saving…" : "Save configuration"}
                </Button>
                {active && (
                  <p className="text-[11px] text-green-600">Activating this gateway deactivates others automatically.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
