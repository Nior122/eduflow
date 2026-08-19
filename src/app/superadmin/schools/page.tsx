"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

type SchoolRow = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  status: string;
  onboardingComplete: boolean;
  createdAt: string;
  subscription: { status: string; trialEndsAt: string | null; plan: { name: string; code: string } } | null;
  _count: { students: number; teachers: number; users: number };
};

const SUB_BADGE: Record<string, string> = {
  TRIALING: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-green-100 text-green-800",
  PAST_DUE: "bg-amber-100 text-amber-800",
  CANCELED: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-700",
};

export default function SchoolsPage() {
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (p = page, q = search) => {
    setLoading(true);
    fetch(`/api/superadmin/schools?page=${p}&pageSize=25&search=${encodeURIComponent(q)}`)
      .then((r) => parseJsonBody(r))
      .then((d) => {
        setRows(d.data ?? []);
        setTotal(d.meta?.total ?? 0);
      })
      .catch(() => toast({ title: "Failed to load schools", variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1, "");
  }, []);

  const toggleStatus = async (row: SchoolRow) => {
    const next = row.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    if (!confirm(`${next === "SUSPENDED" ? "Suspend" : "Activate"} ${row.name}?`)) return;
    const res = await fetch("/api/superadmin/schools", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, status: next }),
    });
    if (res.ok) {
      toast({ title: next === "SUSPENDED" ? "School suspended" : "School activated" });
      load();
    } else {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schools ({total})</h1>
        <div className="flex gap-2">
          <Input placeholder="Search name / slug / email" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
          <Button onClick={() => { setPage(1); load(1, search); }}>Search</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Students / Teachers</TableHead>
                <TableHead>Onboarding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/superadmin/schools/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.email ?? r.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={SUB_BADGE[r.subscription?.status ?? "EXPIRED"] ?? ""}>
                      {r.subscription?.status ?? "NONE"}
                    </Badge>
                    <div className="mt-1 text-xs text-muted-foreground">{r.subscription?.plan.name ?? "—"}</div>
                  </TableCell>
                  <TableCell>{r._count.students} / {r._count.teachers}</TableCell>
                  <TableCell>
                    {r.onboardingComplete ? (
                      <Badge variant="secondary">done</Badge>
                    ) : (
                      <Badge variant="outline">pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "SUSPENDED" ? "destructive" : "default"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => void toggleStatus(r)}>
                      {r.status === "SUSPENDED" ? "Activate" : "Suspend"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && !loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No schools found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {page} of {Math.max(1, Math.ceil(total / 25))}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1, search); }}>Prev</Button>
          <Button size="sm" variant="outline" disabled={page * 25 >= total} onClick={() => { setPage(page + 1); load(page + 1, search); }}>Next</Button>
        </div>
      </div>
    </div>
  );
}
