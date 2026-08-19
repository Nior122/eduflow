"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { KeyRound, Loader2, Copy, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ apiKey: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/admin/api-keys")
      .then((r) => parseJsonBody(r))
      .then((d) => setKeys(d.keys ?? []));

  useEffect(() => {
    load().catch(() => toast({ title: "Failed to load API keys", variant: "destructive" }));
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = await parseJsonBody(res);
      if (!res.ok) throw new Error(d.error ?? "Create failed");
      setCreated(d);
      setName("");
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Create failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this API key? Applications using it will stop working.")) return;
    await fetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
    await load();
  };

  const toggle = async (row: ApiKeyRow) => {
    await fetch(`/api/admin/api-keys/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          Keys authenticate the versioned REST API (<code>/api/v1</code>). Send them as the{" "}
          <code>x-api-key</code> header. The plaintext key is shown only once.
        </p>
      </div>

      {created && (
        <Card className="border-green-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <KeyRound className="h-5 w-5" /> Key created — copy it now
            </CardTitle>
            <CardDescription>It will not be shown again.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted p-2 text-sm break-all">{created.apiKey}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(created.apiKey);
                toast({ title: "Copied" });
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create key</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="keyName">Name</Label>
            <Input id="keyName" placeholder="e.g. School MIS integration" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={() => void create()} disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Generate key
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">No API keys yet</TableCell>
                </TableRow>
              )}
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.name}</TableCell>
                  <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                  <TableCell>
                    <Badge variant={k.isActive ? "default" : "outline"}>{k.isActive ? "active" : "revoked"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => void toggle(k)}>
                        {k.isActive ? "Revoke" : "Enable"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void revoke(k.id)}>
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
