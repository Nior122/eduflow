"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, GraduationCap, Trash2, Loader2, Mail, Phone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getInitials, formatDate } from "@/lib/utils";

type TeacherSubject = {
  class: { id: string; name: string };
  subject: { id: string; name: string };
};

type Teacher = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  employeeDate: string;
  qualification: string | null;
  specialization: string | null;
  profileImage: string | null;
  classSubjects: TeacherSubject[];
  _count: { attendances: number; results: number; lessonPlans: number };
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    qualification: "", specialization: "", employeeDate: "",
  });

  useEffect(() => {
    fetch("/api/admin/teachers")
      .then((r) => r.ok && r.json())
      .then((d) => d?.teachers && setTeachers(d.teachers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      return toast({ title: "Name and email are required", variant: "destructive" });
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Teacher added", variant: "success" });
      setDialogOpen(false);
      setFormData({ firstName: "", lastName: "", email: "", phone: "", qualification: "", specialization: "", employeeDate: "" });
      const updated = await fetch("/api/admin/teachers").then((r) => r.json());
      setTeachers(updated.teachers);
    } catch {
      toast({ title: "Failed to add teacher", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teachers</h2>
          <p className="text-muted-foreground">Manage teaching staff and their assignments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient"><Plus className="mr-2 h-4 w-4" /> Add Teacher</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add New Teacher</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>First Name</Label><Input value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} /></div>
                <div className="space-y-2"><Label>Last Name</Label><Input value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} /></div>
              </div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} /></div>
                <div className="space-y-2"><Label>Employment Date</Label><Input type="date" value={formData.employeeDate} onChange={(e) => setFormData({...formData, employeeDate: e.target.value})} /></div>
              </div>
              <div className="space-y-2"><Label>Qualification</Label><Input value={formData.qualification} onChange={(e) => setFormData({...formData, qualification: e.target.value})} placeholder="e.g. B.Ed, M.Sc" /></div>
              <div className="space-y-2"><Label>Specialization</Label><Input value={formData.specialization} onChange={(e) => setFormData({...formData, specialization: e.target.value})} placeholder="e.g. Mathematics" /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Teacher"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden md:table-cell">Assignments</TableHead>
                <TableHead className="hidden lg:table-cell">Qualification</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : teachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <GraduationCap className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No teachers added yet</p>
                      <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>Add your first teacher</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                teachers.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(`${t.firstName} ${t.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{t.firstName} {t.lastName}</p>
                          <p className="text-xs text-muted-foreground">{t.specialization || "General"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {t.email}</span>
                        {t.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {t.phone}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {t.classSubjects.length > 0 ? (
                          t.classSubjects.slice(0, 2).map((cs) => (
                            <Badge key={`${cs.class.id}-${cs.subject.id}`} variant="secondary" className="text-xs">
                              {cs.subject.name} ({cs.class.name})
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">Not assigned</span>
                        )}
                        {t.classSubjects.length > 2 && (
                          <Badge variant="outline" className="text-xs">+{t.classSubjects.length - 2} more</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{t.qualification || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(t.employeeDate)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
