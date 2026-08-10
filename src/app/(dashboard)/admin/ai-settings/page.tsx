"use client";

import { useEffect, useState } from "react";
import { Settings, Loader2, Save, Zap, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Provider = { id: string; label: string; defaultModel: string; configured: boolean };
type SettingsData = {
  provider: string;
  model: string | null;
  temperature: number;
  maxTokens: number;
  streamingEnabled: boolean;
  fallbackProvider: boolean;
  monthlyBudgetCents: number;
  modulesEnabled: Record<string, boolean>;
};

const MODULE_LABELS: Record<string, string> = {
  assistant: "AI Assistant",
  lesson_planner: "Lesson Planner",
  report_comment: "Report Comments",
  performance_analyzer: "Performance Analyzer",
  homework_assistant: "Homework Assistant",
  question_generator: "Question Generator",
  exam_generator: "Exam Generator",
  risk_prediction: "Risk Prediction",
  parent_communication: "Parent Communication",
  analytics: "School Analytics",
  document_assistant: "Document Assistant",
  knowledge_base: "Knowledge Base",
};

export default function AdminAiSettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [activeReady, setActiveReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; model?: string; latencyMs?: number; error?: string; sample?: string } | null>(null);

  useEffect(() => {
    fetch("/api/ai/settings")
      .then((r) => r.json())
      .then((d) => {
        setProviders(d.providers ?? []);
        setSettings(d.settings ?? null);
        setActiveReady(d.activeProviderReady ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (patch: Partial<SettingsData>) => setSettings((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ai/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast({ title: "AI settings saved", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!settings) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: settings.provider as never, model: settings.model ?? undefined }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-96" /></div>;
  if (!settings) return <p className="text-muted-foreground">Could not load AI settings.</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" /> AI Settings
          </h2>
          <p className="text-muted-foreground">Provider, model, limits and permissions — keys stay in environment variables</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={test} disabled={testing}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Test connection
          </Button>
          <Button variant="gradient" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save settings
          </Button>
        </div>
      </div>

      {testResult && (
        <Card className={testResult.ok ? "border-emerald-500/40" : "border-destructive/40"}>
          <CardContent className="p-4 text-sm">
            {testResult.ok ? (
              <p className="text-emerald-600">✓ Connection OK — {testResult.model} · {testResult.latencyMs}ms{testResult.sample ? ` · “${testResult.sample}”` : ""}</p>
            ) : (
              <p className="text-destructive">✗ {testResult.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Provider</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Active provider</Label>
              <Select value={settings.provider} onValueChange={(v) => update({ provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={!p.configured}>
                      {p.label}{p.configured ? "" : " (no key)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {activeReady ? "Active provider key is configured ✓" : "No API key configured for the active provider — set it in environment variables and redeploy."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {providers.map((p) => (
                <Badge key={p.id} variant={p.configured ? "success" : "secondary"}>
                  {p.label}{p.configured ? " ✓" : ""}
                </Badge>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Model (leave empty for default)</Label>
              <Input value={settings.model ?? ""} onChange={(e) => update({ model: e.target.value || null })} placeholder={providers.find((p) => p.id === settings.provider)?.defaultModel} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Generation & cost controls</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Temperature (0–2)</Label>
                <Input type="number" min={0} max={2} step={0.1} value={settings.temperature} onChange={(e) => update({ temperature: Number(e.target.value) || 0.7 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Max tokens</Label>
                <Input type="number" min={64} max={16384} value={settings.maxTokens} onChange={(e) => update({ maxTokens: Number(e.target.value) || 2048 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monthly budget (USD cents)</Label>
                <Input type="number" min={0} value={settings.monthlyBudgetCents} onChange={(e) => update({ monthlyBudgetCents: Number(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end gap-2">
                <button onClick={() => update({ streamingEnabled: !settings.streamingEnabled })} className={`rounded-lg border px-3 py-2 text-sm font-medium text-left ${settings.streamingEnabled ? "border-primary bg-primary/10" : ""}`}>
                  Streaming responses: {settings.streamingEnabled ? "ON" : "OFF"}
                </button>
                <button onClick={() => update({ fallbackProvider: !settings.fallbackProvider })} className={`rounded-lg border px-3 py-2 text-sm font-medium text-left ${settings.fallbackProvider ? "border-primary bg-primary/10" : ""}`}>
                  Fallback to next provider: {settings.fallbackProvider ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Modules</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(MODULE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => update({ modulesEnabled: { ...settings.modulesEnabled, [key]: !settings.modulesEnabled[key] } })}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${settings.modulesEnabled[key] ? "border-primary/50 bg-primary/5" : "opacity-60"}`}
            >
              {label}
              <Badge variant={settings.modulesEnabled[key] ? "success" : "secondary"}>{settings.modulesEnabled[key] ? "On" : "Off"}</Badge>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
