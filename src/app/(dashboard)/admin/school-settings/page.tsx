"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { School, Loader2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type School = {
  id: string;
  name: string;
  motto: string | null;
  principal: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  currency: string;
  timeZone: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  gradeSystem: string | null;
  attendanceRules: string | null;
};

export default function SchoolSettingsPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", motto: "", principal: "", address: "", phone: "", email: "", website: "",
    currency: "NGN", timeZone: "", primaryColor: "", secondaryColor: "",
    gradeSystem: "", attendanceRules: "",
  });

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.ok && r.json())
      .then((d) => {
        if (d?.school) {
          setSchool(d.school);
          setForm({
            name: d.school.name ?? "",
            motto: d.school.motto ?? "",
            principal: d.school.principal ?? "",
            address: d.school.address ?? "",
            phone: d.school.phone ?? "",
            email: d.school.email ?? "",
            website: d.school.website ?? "",
            currency: d.school.currency ?? "NGN",
            timeZone: d.school.timeZone ?? "",
            primaryColor: d.school.primaryColor ?? "",
            secondaryColor: d.school.secondaryColor ?? "",
            gradeSystem: d.school.gradeSystem ?? "",
            attendanceRules: d.school.attendanceRules ?? "",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.name) return toast({ title: "School name is required", variant: "destructive" });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSchool(data.school);
      toast({ title: "School settings saved", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <School className="h-6 w-6 text-primary" /> School Settings
        </h2>
        <p className="text-muted-foreground">Configure your school's identity and academic rules</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">School Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>School Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Motto</Label><Input value={form.motto} onChange={(e) => setForm({ ...form, motto: e.target.value })} /></div>
          <div className="space-y-2"><Label>Principal</Label><Input value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} /></div>
          <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-2"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
          <div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="NGN" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Time Zone</Label><Input value={form.timeZone} onChange={(e) => setForm({ ...form, timeZone: e.target.value })} placeholder="Africa/Lagos" /></div>
          <div className="space-y-2"><Label>Primary Color</Label><Input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} placeholder="#2563eb" /></div>
          <div className="space-y-2"><Label>Secondary Color</Label><Input value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} placeholder="#4f46e5" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Academic Structure</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label>Grade System</Label>
            <Textarea rows={3} value={form.gradeSystem} onChange={(e) => setForm({ ...form, gradeSystem: e.target.value })}
              placeholder="e.g. A: 75-100, B: 65-74, C: 55-64, D: 45-54, E: 40-44, F: 0-39" />
          </div>
          <div className="space-y-2">
            <Label>Attendance Rules</Label>
            <Textarea rows={3} value={form.attendanceRules} onChange={(e) => setForm({ ...form, attendanceRules: e.target.value })}
              placeholder="e.g. 75% minimum attendance required to sit exams; excused absences require a note" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="gradient" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Settings</>}
        </Button>
      </div>
    </div>
  );
}
