"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, RotateCcw, Plus } from "lucide-react";

type Band = {
  name: string;
  minScore: number;
  maxScore: number;
  remark: string;
  gpa: number | null;
  isPass: boolean;
  color: string | null;
  sortOrder: number;
};

const DEFAULT_BANDS: Band[] = [
  { name: "A", minScore: 70, maxScore: 100, remark: "Excellent", gpa: 4.0, isPass: true, color: "text-green-600", sortOrder: 1 },
  { name: "B", minScore: 60, maxScore: 69, remark: "Very Good", gpa: 3.5, isPass: true, color: "text-green-600", sortOrder: 2 },
  { name: "C", minScore: 50, maxScore: 59, remark: "Good", gpa: 3.0, isPass: true, color: "text-yellow-600", sortOrder: 3 },
  { name: "D", minScore: 45, maxScore: 49, remark: "Fair", gpa: 2.5, isPass: true, color: "text-yellow-600", sortOrder: 4 },
  { name: "E", minScore: 40, maxScore: 44, remark: "Poor", gpa: 2.0, isPass: true, color: "text-orange-600", sortOrder: 5 },
  { name: "F", minScore: 0, maxScore: 39, remark: "Fail", gpa: 1.0, isPass: false, color: "text-red-600", sortOrder: 6 },
];

export default function GradeScalePage() {
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/grade-bands");
      const data = await parseJsonBody(res);
      const loaded = data.gradeBands ?? [];
      setBands(loaded.length ? loaded.map((b: Band) => ({ ...b })) : DEFAULT_BANDS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (i: number, patch: Partial<Band>) => {
    setBands((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  };

  const save = async () => {
    setSaving(true);
    try {
      // Detect overlaps client-side before sending.
      const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].minScore <= sorted[i - 1].maxScore) {
          throw new Error(`Grade bands overlap: ${sorted[i - 1].name} (max ${sorted[i - 1].maxScore}) and ${sorted[i].name} (min ${sorted[i].minScore})`);
        }
      }
      const res = await fetch("/api/grade-bands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bands }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed to save grade scale");
      setBands(data.gradeBands ?? bands);
      toast({ title: "Grading scale saved" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetDefault = () => {
    setBands(DEFAULT_BANDS.map((b) => ({ ...b })));
    toast({ title: "Default scale loaded — click Save to apply" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Grading Scale</h2>
          <p className="text-sm text-muted-foreground">
            Percentage bands used by the grade engine. Every score maps to exactly one band (bands are [min, next-min)).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetDefault}><RotateCcw className="h-4 w-4 mr-1" /> Load default</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {saving ? "Saving…" : "Save scale"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Grade bands</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grade</TableHead>
                  <TableHead className="w-32">Min %</TableHead>
                  <TableHead className="w-32">Max %</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead className="w-28">GPA</TableHead>
                  <TableHead>Pass?</TableHead>
                  <TableHead className="w-24">Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bands.map((b, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        className="h-9 w-16 font-bold text-center"
                        value={b.name}
                        onChange={(e) => update(i, { name: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input className="h-9" type="number" min={0} max={100} value={b.minScore}
                        onChange={(e) => update(i, { minScore: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-9" type="number" min={0} max={100} value={b.maxScore}
                        onChange={(e) => update(i, { maxScore: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-9" value={b.remark} onChange={(e) => update(i, { remark: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-9" type="number" step={0.1} min={0} max={5} value={b.gpa ?? ""}
                        onChange={(e) => update(i, { gpa: e.target.value === "" ? null : Number(e.target.value) })} />
                    </TableCell>
                    <TableCell>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={b.isPass}
                          onChange={(e) => update(i, { isPass: e.target.checked })}
                          className="h-4 w-4 accent-primary"
                        />
                        {b.isPass ? "Pass" : "Fail"}
                      </label>
                    </TableCell>
                    <TableCell>
                      <Input className="h-9" type="number" value={b.sortOrder}
                        onChange={(e) => update(i, { sortOrder: Number(e.target.value) })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => setBands([...bands, { name: "", minScore: 0, maxScore: 0, remark: "", gpa: null, isPass: true, color: null, sortOrder: bands.length + 1 }])}>
              <Plus className="h-4 w-4 mr-1" /> Add band
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Scores below the lowest band&apos;s min fall to that band automatically. GPA is optional (decimal, e.g. 3.5).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
