"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, Plus, Loader2, Wallet } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

type Fee = {
  id: string; name: string; description: string | null; amount: string; term: string | null;
  isOptional: boolean; isActive: boolean; _count: { feeRecords: number };
};

export default function FeesPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", amount: "", term: "FIRST", isOptional: "false" });

  useEffect(() => {
    fetch("/api/admin/fees")
      .then(r => r.ok && r.json())
      .then(d => { if (d?.fees) setFees(d.fees); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!formData.name || !formData.amount) return toast({ title: "Name and amount required", variant: "destructive" });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, amount: parseFloat(formData.amount), isOptional: formData.isOptional === "true" }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Fee created", variant: "success" });
      setDialogOpen(false);
      setFormData({ name: "", description: "", amount: "", term: "FIRST", isOptional: "false" });
      fetch("/api/admin/fees").then(r => r.json()).then(d => d?.fees && setFees(d.fees));
    } catch { toast({ title: "Failed to create fee", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const totalCollected = fees.reduce((sum, f) => sum + parseFloat(f.amount) * f._count.feeRecords, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fee Management</h2>
          <p className="text-muted-foreground">Manage tuition, books, and other fees</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient"><Plus className="mr-2 h-4 w-4" /> Add Fee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Fee Type</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>Fee Name</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Tuition" /></div>
              <div className="space-y-2"><Label>Amount (₦)</Label><Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
              <div className="space-y-2"><Label>Term</Label><Select value={formData.term} onValueChange={v => setFormData({...formData, term: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIRST">First Term</SelectItem><SelectItem value="SECOND">Second Term</SelectItem><SelectItem value="THIRD">Third Term</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Optional?</Label><Select value={formData.isOptional} onValueChange={v => setFormData({...formData, isOptional: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="false">Required</SelectItem><SelectItem value="true">Optional</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Description</Label><Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Create Fee"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Fees" value={formatCurrency(totalCollected)} icon={DollarSign} />
        <StatCard title="Fee Types" value={fees.length} icon={Wallet} />
        <StatCard title="Collection Rate" value="72%" icon={TrendingUp} trend={8} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden md:table-cell">Term</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="text-right">Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}><TableCell><Skeleton className="h-8 w-32" /></TableCell><TableCell><Skeleton className="h-8 w-24" /></TableCell><TableCell><Skeleton className="h-8 w-20" /></TableCell><TableCell><Skeleton className="h-8 w-20" /></TableCell><TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell></TableRow>
              )) : fees.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell>{formatCurrency(f.amount)}</TableCell>
                  <TableCell className="hidden md:table-cell">{f.term ? f.term.charAt(0) + f.term.slice(1).toLowerCase() + " Term" : "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{f.isOptional ? <Badge variant="outline">Optional</Badge> : <Badge>Required</Badge>}</TableCell>
                  <TableCell className="text-right">{f._count.feeRecords}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
