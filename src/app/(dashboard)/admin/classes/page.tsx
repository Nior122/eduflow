"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, BookOpen, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Class = {
  id: string;
  name: string;
  category: string;
  section: string | null;
  capacity: number | null;
  _count: { students: number };
};

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: "", category: "PRIMARY", section: "" });

  useEffect(() => {
    fetch("/api/admin/classes")
      .then((r) => r.ok && r.json())
      .then((d) => d?.classes && setClasses(d.classes))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!formData.name) return toast({ title: "Class name required", variant: "destructive" });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Class created", variant: "success" });
      setDialogOpen(false);
      setFormData({ name: "", category: "PRIMARY", section: "" });
      const updated = await fetch("/api/admin/classes").then((r) => r.json());
      setClasses(updated.classes);
    } catch {
      toast({ title: "Failed to create class", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "PRIMARY": return <Badge variant="info">Primary</Badge>;
      case "JUNIOR_SECONDARY": return <Badge variant="warning">JSS</Badge>;
      case "SENIOR_SECONDARY": return <Badge variant="success">SS</Badge>;
      default: return <Badge>{cat}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Classes</h2>
          <p className="text-muted-foreground">Manage class structure and sections</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient"><Plus className="mr-2 h-4 w-4" /> Add Class</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New Class</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Class Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Primary 1" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIMARY">Primary</SelectItem>
                    <SelectItem value="JUNIOR_SECONDARY">Junior Secondary (JSS)</SelectItem>
                    <SelectItem value="SENIOR_SECONDARY">Senior Secondary (SS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section (optional)</Label>
                <Input value={formData.section} onChange={(e) => setFormData({...formData, section: e.target.value})} placeholder="e.g. A, B, or Science" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Create Class"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          : classes.map((cls) => (
              <Card key={cls.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{cls.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {getCategoryBadge(cls.category)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">
                        {cls.section ? `Section: ${cls.section}` : "No section"}
                      </p>
                      <p className="text-muted-foreground">
                        {cls.capacity ? `Capacity: ${cls.capacity}` : "Unlimited capacity"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{cls._count.students}</p>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}
