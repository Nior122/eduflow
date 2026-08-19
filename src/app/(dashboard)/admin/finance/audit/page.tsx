"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { History, Loader2 } from "lucide-react";

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ip: string | null;
  createdAt: string;
  actor: { name: string | null; email: string | null } | null;
};

const ACTION_BADGE: Record<string, string> = {
  PAYMENT_RECORD: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  RECEIPT_GENERATE: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  INVOICE_GENERATE: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  INVOICE_CREATE: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  INVOICE_EDIT: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  INVOICE_ISSUE: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  INVOICE_CANCEL: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  DISCOUNT_CREATE: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  DISCOUNT_APPROVE: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  DISCOUNT_REJECT: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  PLAN_CREATE: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  PLAN_UPDATE: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  REMINDER_SENT: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  GATEWAY_UPDATE: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  FEE_CREATE: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  FEE_UPDATE: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  FEE_DELETE: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  FEECATEGORY_CREATE: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  FEECATEGORY_UPDATE: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  FEECATEGORY_DELETE: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entity) params.set("entity", entity);
      if (action) params.set("action", action);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (search) params.set("search", search);
      const res = await fetch(`/api/finance/audit?${params}`);
      const data = await parseJsonBody(res);
      setLogs(data.logs ?? []);
    } finally {
      setLoading(false);
    }
  }, [entity, action, from, to, search]);

  useEffect(() => { load(); }, [load]);

  const jsonShort = (v: unknown) => {
    if (v === null || v === undefined) return "—";
    try {
      const s = JSON.stringify(v);
      return s.length > 90 ? s.slice(0, 90) + "…" : s;
    } catch {
      return String(v);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><History className="h-5 w-5" /> Finance Audit Log</h2>
        <p className="text-sm text-muted-foreground">Every financial action — who, what, when, old and new values.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Entity</Label>
              <Select value={entity} onValueChange={(v) => setEntity(v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All entities</SelectItem>
                  <SelectItem value="Payment">Payment</SelectItem>
                  <SelectItem value="Receipt">Receipt</SelectItem>
                  <SelectItem value="Invoice">Invoice</SelectItem>
                  <SelectItem value="Discount">Discount</SelectItem>
                  <SelectItem value="PaymentPlan">PaymentPlan</SelectItem>
                  <SelectItem value="Fee">Fee</SelectItem>
                  <SelectItem value="FeeCategory">FeeCategory</SelectItem>
                  <SelectItem value="LatePayment">LatePayment</SelectItem>
                  <SelectItem value="PaymentGatewayConfig">PaymentGatewayConfig</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Action</Label>
              <Select value={action} onValueChange={(v) => setAction(v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All actions</SelectItem>
                  <SelectItem value="PAYMENT_RECORD">Payment record</SelectItem>
                  <SelectItem value="RECEIPT_GENERATE">Receipt generate</SelectItem>
                  <SelectItem value="INVOICE_GENERATE">Invoice generate</SelectItem>
                  <SelectItem value="INVOICE_ISSUE">Invoice issue</SelectItem>
                  <SelectItem value="INVOICE_CANCEL">Invoice cancel</SelectItem>
                  <SelectItem value="DISCOUNT_APPROVE">Discount approve</SelectItem>
                  <SelectItem value="DISCOUNT_REJECT">Discount reject</SelectItem>
                  <SelectItem value="PLAN_CREATE">Plan create</SelectItem>
                  <SelectItem value="REMINDER_SENT">Reminder sent</SelectItem>
                  <SelectItem value="GATEWAY_UPDATE">Gateway update</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Search (actor / id)</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{logs.length} record(s)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Old → New</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No audit records match.</TableCell></TableRow>
                )}
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{l.actor?.name ?? "—"}</TableCell>
                    <TableCell><Badge className={ACTION_BADGE[l.action] ?? ""}>{l.action}</Badge></TableCell>
                    <TableCell className="text-xs">{l.entity}{l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ""}</TableCell>
                    <TableCell className="text-xs font-mono max-w-xs truncate">
                      <span className="text-muted-foreground">{jsonShort(l.oldValue)}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="text-foreground">{jsonShort(l.newValue)}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.ip ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
