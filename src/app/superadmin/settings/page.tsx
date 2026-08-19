"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Settings = {
  allowRegistration: boolean;
  defaultTrialDays: number;
  defaultPlanCode: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  currency: string;
  supportEmail: string | null;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/superadmin/settings")
      .then((r) => parseJsonBody(r))
      .then((d) => setSettings(d.settings))
      .catch(() => toast({ title: "Failed to load settings", variant: "destructive" }));
  }, []);

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    const res = await fetch("/api/superadmin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) toast({ title: "Settings saved" });
    else toast({ title: "Save failed", variant: "destructive" });
    setBusy(false);
  };

  if (!settings) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Platform settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Registration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={settings.allowRegistration}
              onCheckedChange={(v) => setSettings({ ...settings, allowRegistration: v === true })}
            />
            Allow new school registrations
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Trial days</Label>
              <Input type="number" value={settings.defaultTrialDays} onChange={(e) => setSettings({ ...settings, defaultTrialDays: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Default plan code</Label>
              <Input value={settings.defaultPlanCode} onChange={(e) => setSettings({ ...settings, defaultPlanCode: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-2">
              <Label>Support email</Label>
              <Input value={settings.supportEmail ?? ""} onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={settings.maintenanceMode}
              onCheckedChange={(v) => setSettings({ ...settings, maintenanceMode: v === true })}
            />
            Put the platform in maintenance mode (503 for APIs, maintenance page otherwise)
          </label>
          <div className="space-y-2">
            <Label>Maintenance message (optional)</Label>
            <Input value={settings.maintenanceMessage ?? ""} onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => void save()} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save settings
      </Button>
    </div>
  );
}
