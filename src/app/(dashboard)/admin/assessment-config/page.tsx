"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Loader2, Save, Pencil, Trash2, Percent } from "lucide-react";

type AssessmentType = {
  id: string;
  name: string;
  code: string | null;
  kind: "CA" | "EXAM";
  weight: number;
  maxScore: number;
  sortOrder: number;
  isActive: boolean;
  configs: { termId: string; weight: number; maxScore: number }[];
  _count: { scores: number };
};

type Term = { id: string; name: string; session: { name: string } };

const emptyForm = { name: "", code: "", kind: "CA" as "CA" | "EXAM", weight: 0, maxScore: 100, sortOrder: 0, isActive: true };

export default function AssessmentConfigPage() {
  const [types, setTypes] = useState<AssessmentType[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [termWeights, setTermWeights] = useState<Record<string, { weight: string; maxScore: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [typeRes, termRes] = await Promise.all([
        fetch(`/api/assessment-types${selectedTerm ? `?termId=${selectedTerm}` : ""}`),
        fetch("/api/admin/terms"),
      ]);
      const typeData = await parseJsonBody(typeRes);
      const termData = await parseJsonBody(termRes);
      setTypes(typeData.assessmentTypes ?? []);
      setTerms(termData.terms ?? []);
      if (termData.terms?.[0] && !selectedTerm) {
        setSelectedTerm(termData.terms[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedTerm]);

  useEffect(() => { load(); }, [load]);

  const totalWeight = types.reduce((s, t) => s + (t.isActive ? (termWeights[t.id] ? Number(termWeights[t.id].weight) : t.weight) : 0), 0);

  const save = async () => {
    setSaving(true);
    try {
      const body = editingId
        ? { ...form, weight: Number(form.weight), maxScore: Number(form.maxScore), sortOrder: Number(form.sortOrder) }
        : { ...form, weight: Number(form.weight), maxScore: Number(form.maxScore), sortOrder: Number(form.sortOrder) };
      const res = await fetch(editingId ? `/api/assessment-types/${editingId}` : "/api/assessment-types", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast({ title: editingId ? "Assessment type updated" : "Assessment type created" });
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveTermConfig = async () => {
    if (!selectedTerm) return;
    setSaving(true);
    try {
      const items = types.map((t) => ({
        assessmentTypeId: t.id,
        weight: Number(termWeights[t.id]?.weight ?? t.weight),
        maxScore: Number(termWeights[t.id]?.maxScore ?? t.maxScore),
      }));
      const res = await fetch("/api/assessment-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termId: selectedTerm, items }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed to save term config");
      toast({ title: "Term assessment config saved" });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: AssessmentType) => {
    try {
      const res = await fetch(`/api/assessment-types/${t.id}`, { method: "DELETE" });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast({ title: "Assessment type deleted" });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Delete failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Assessment Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Define assessment components and their percentage weights. Active weights must total <b>100%</b> (currently <b>{totalWeight}%</b>).
          </p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Component
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Components &amp; weights</CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Per-term config for</Label>
              <Select value={selectedTerm} onValueChange={(v) => setSelectedTerm(v)}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Select term" /></SelectTrigger>
                <SelectContent>
                  {terms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.session.name} · Term {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={saveTermConfig} disabled={saving || !selectedTerm}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save term config
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Weight %</TableHead>
                  <TableHead className="text-right">Max score</TableHead>
                  <TableHead className="text-right">Term override</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t) => {
                  const override = t.configs[0];
                  const isOverride = !!override;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{t.code ?? "—"}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.kind === "CA" ? "secondary" : "default"}>
                          {t.kind === "CA" ? "Continuous Assessment" : "Examination"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {isOverride ? override.weight : t.weight}%
                      </TableCell>
                      <TableCell className="text-right">{isOverride ? override.maxScore : t.maxScore}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="h-8 w-16 text-sm"
                            value={termWeights[t.id]?.weight ?? ""}
                            placeholder={String(isOverride ? override.weight : t.weight)}
                            onChange={(e) => setTermWeights({ ...termWeights, [t.id]: { ...termWeights[t.id], weight: e.target.value } })}
                          />
                          <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            type="number"
                            min={1}
                            className="h-8 w-16 text-sm"
                            value={termWeights[t.id]?.maxScore ?? ""}
                            placeholder={String(isOverride ? override.maxScore : t.maxScore)}
                            onChange={(e) => setTermWeights({ ...termWeights, [t.id]: { ...termWeights[t.id], maxScore: e.target.value } })}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.isActive ? "success" : "secondary"}>{t.isActive ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => { setEditingId(t.id); setForm({ name: t.name, code: t.code ?? "", kind: t.kind, weight: t.weight, maxScore: t.maxScore, sortOrder: t.sortOrder, isActive: t.isActive }); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(t)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {types.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No assessment components configured.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Example: Assignment 10% · Class Test 20% · Project 10% · Exam 60% = 100%. The score engine computes
            contribution = (score ÷ maxScore) × weight for each component.
          </p>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "Edit Component" : "Add Assessment Component"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Practical" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="PRACTICAL" />
              </div>
              <div className="space-y-1.5">
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as "CA" | "EXAM" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CA">Continuous Assessment</SelectItem>
                    <SelectItem value="EXAM">Examination</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Weight (%)</Label>
                <Input type="number" min={0} max={100} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Max score</Label>
                <Input type="number" min={1} value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: Number(e.target.value) })} />
              </div>
            </div>
            <Button className="w-full" onClick={save} disabled={saving || !form.name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save Component"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
