"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, DatabaseBackup } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Backup = {
  id: string;
  kind: string;
  status: string;
  url: string | null;
  sizeBytes: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-blue-100 text-blue-800",
  RUNNING: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

export default function BackupsPage() {
  const [jobs, setJobs] = useState<Backup[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/superadmin/backups")
      .then((r) => parseJsonBody(r))
      .then((d) => setJobs(d.jobs ?? []))
      .catch(() => toast({ title: "Failed to load backups", variant: "destructive" }));

  useEffect(() => {
    load();
  }, []);

  const request = async () => {
    setBusy(true);
    const res = await fetch("/api/superadmin/backups", { method: "POST" });
    if (res.ok) {
      toast({ title: "Backup job queued — see docs/OPERATIONS.md for the pg_dump runner" });
      await load();
    } else {
      toast({ title: "Failed to queue backup", variant: "destructive" });
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Backups</h1>
          <p className="text-sm text-muted-foreground">
            Backup jobs are recorded here; the actual <code>pg_dump</code> runs in{" "}
            <code>scripts/backup.ts</code> (also scheduled on Neon/Vercel — see docs/OPERATIONS.md).
          </p>
        </div>
        <Button onClick={() => void request()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseBackup className="mr-2 h-4 w-4" />} Request manual backup
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-xs">{new Date(j.createdAt).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{j.kind}</Badge></TableCell>
                  <TableCell><Badge className={STATUS_STYLE[j.status] ?? ""}>{j.status}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {j.sizeBytes !== null ? `${(j.sizeBytes / 1024 / 1024).toFixed(1)} MB` : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{j.completedAt ? new Date(j.completedAt).toLocaleString() : "—"}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs text-red-600">{j.error ?? "—"}</TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No backup jobs yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
