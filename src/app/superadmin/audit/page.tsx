"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "@/hooks/use-toast";

type AuditRow = {
  id: string;
  action: string;
  category: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  school: { name: string } | null;
  actor: { name: string | null; email: string } | null;
};

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const load = (c = category) => {
    setLoading(true);
    fetch(`/api/superadmin/audit?category=${c}&pageSize=100`)
      .then((r) => parseJsonBody(r))
      .then((d) => setRows(d.data ?? []))
      .catch(() => toast({ title: "Failed to load audit log", variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load("ALL");
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit log</h1>
        <Select value={category} onValueChange={(v) => { setCategory(v); load(v); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["ALL", "AUTH", "BILLING", "TENANT", "SECURITY", "ADMIN", "ONBOARDING", "API"].map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{rows.length} entries</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[70vh] overflow-y-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.action}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{r.category}</Badge></TableCell>
                    <TableCell className="text-xs">{r.school?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.actor?.email ?? "system"}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No audit entries</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
