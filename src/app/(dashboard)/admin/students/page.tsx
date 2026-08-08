"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Pencil, Trash2, Eye, UserPlus, Loader2, ChevronLeft, ChevronRight,
  Download, Upload, IdCard, History, GraduationCap, AlertTriangle, ArrowRightLeft, ArrowUpCircle, RotateCcw,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getInitials, formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CredentialsDialog } from "@/components/credentials-dialog";

type Class = { id: string; name: string; category: string };

type Student = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  admissionNumber: string;
  gender: string | null;
  dateOfBirth: string | null;
  address: string | null;
  enrollmentDate: string;
  admissionStatus: string;
  class: { id: string; name: string } | null;
  parent: { id: string; firstName: string; lastName: string } | null;
  _count: { attendances: number; results: number };
  parentRelation: string | null;
  bloodGroup: string | null;
  religion: string | null;
  nationality: string | null;
  state: string | null;
  lga: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  previousSchool: string | null;
  medicalInfo: string | null;
  disabilities: string | null;
};

type TimelineEntry = { id: string; event: string; note: string | null; createdAt: string };

type StudentDetail = Student & {
  parentRelation: string | null;
  bloodGroup: string | null;
  religion: string | null;
  nationality: string | null;
  state: string | null;
  lga: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  previousSchool: string | null;
  medicalInfo: string | null;
  disabilities: string | null;
  results: { id: string; subject: { name: string }; total: string | null; grade: string | null; term: string }[];
  feeRecords: { id: string; fee: { name: string }; amount: string; status: string }[];
  timeline: TimelineEntry[];
};

const EMPTY_FORM = {
  firstName: "", middleName: "", lastName: "", email: "", phone: "", gender: "",
  admissionNumber: "", classId: "", dateOfBirth: "", address: "",
  bloodGroup: "", religion: "", nationality: "", state: "", lga: "",
  emergencyContactName: "", emergencyContactPhone: "", previousSchool: "",
  medicalInfo: "", disabilities: "", parentRelation: "",
};

const LIMIT = 25;

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

const statusVariant = (s: string) =>
  s === "ACTIVE" ? "success" : s === "SUSPENDED" ? "destructive" : s === "GRADUATED" ? "info" : s === "TRANSFERRED" ? "warning" : "outline";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [viewing, setViewing] = useState<StudentDetail | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  const [creds, setCreds] = useState<{ email: string; tempPassword: string } | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; failed: number } | null>(null);

  const [idCardOpen, setIdCardOpen] = useState(false);
  const [schoolName, setSchoolName] = useState("");

  const [statusAction, setStatusAction] = useState<{ action: string; newClassId: string } | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const loadStudents = useCallback(async () => {
    const params = new URLSearchParams();
    if (classFilter && classFilter !== "all") params.set("classId", classFilter);
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("page", String(page));
    params.set("limit", String(LIMIT));

    try {
      const res = await fetch(`/api/admin/students?${params}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, classFilter, statusFilter, page]);

  useEffect(() => {
    loadStudents();
    fetch("/api/admin/classes").then(r => r.ok && r.json()).then(d => d?.classes && setClasses(d.classes)).catch(() => {});
    fetch("/api/admin/settings").then(r => r.ok && r.json()).then(d => d?.school && setSchoolName(d.school.name)).catch(() => {});
  }, [loadStudents]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (student: Student) => {
    setEditing(student);
    setFormData({
      firstName: student.firstName,
      middleName: student.middleName ?? "",
      lastName: student.lastName,
      email: student.email ?? "",
      phone: student.phone ?? "",
      gender: student.gender ?? "",
      admissionNumber: student.admissionNumber,
      classId: student.class?.id ?? "",
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().slice(0, 10) : "",
      address: student.address ?? "",
      bloodGroup: student.bloodGroup ?? "",
      religion: student.religion ?? "",
      nationality: student.nationality ?? "",
      state: student.state ?? "",
      lga: student.lga ?? "",
      emergencyContactName: student.emergencyContactName ?? "",
      emergencyContactPhone: student.emergencyContactPhone ?? "",
      previousSchool: student.previousSchool ?? "",
      medicalInfo: student.medicalInfo ?? "",
      disabilities: student.disabilities ?? "",
      parentRelation: student.parentRelation ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName) {
      return toast({ title: "First and last name are required", variant: "destructive" });
    }
    setSaving(true);
    try {
      const res = editing
        ? await fetch(`/api/admin/students/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          })
        : await fetch("/api/admin/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast({ title: editing ? "Student updated" : "Student created", variant: "success" });
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
      if (!editing && data.credentials) {
        setCreds({ email: data.credentials.email, tempPassword: data.credentials.tempPassword });
      }
      loadStudents();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save student", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (student: Student) => {
    try {
      const res = await fetch(`/api/admin/students/${student.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Student deleted", variant: "success" });
      loadStudents();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleView = async (student: Student) => {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const res = await fetch(`/api/admin/students/${student.id}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setViewing(data.student);
    } catch {
      toast({ title: "Failed to load student details", variant: "destructive" });
      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (classFilter !== "all") params.set("classId", classFilter);
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/students/export?${params}`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export started", variant: "success" });
    } catch {
      toast({ title: "Failed to export", variant: "destructive" });
    }
  };

  const handleImport = async () => {
    const rows = parseCsvRows(importText)
      .map((r) => ({
        admissionNumber: r["Admission Number"] || undefined,
        firstName: r["First Name"],
        lastName: r["Last Name"],
        middleName: r["Middle Name"] || undefined,
        email: r["Email"] || "",
        phone: r["Phone"] || undefined,
        gender: (r["Gender"] || "").toUpperCase() || undefined,
        dateOfBirth: r["Date of Birth"] || undefined,
        className: r["Class"] || undefined,
      }))
      .filter((r) => r.firstName && r.lastName);
    if (rows.length === 0) {
      return toast({ title: "No valid rows found — check the CSV format", variant: "destructive" });
    }
    setImporting(true);
    try {
      const res = await fetch("/api/admin/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setImportResult({ created: data.created ?? 0, failed: data.failed ?? 0 });
      setImportText("");
      toast({ title: `${data.created ?? 0} students imported`, variant: "success" });
      loadStudents();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const applyStatusAction = async () => {
    if (!viewing || !statusAction) return;
    setStatusBusy(true);
    try {
      const payload: Record<string, unknown> = { action: statusAction.action };
      if (statusAction.newClassId) payload.newClassId = statusAction.newClassId;
      const res = await fetch(`/api/admin/students/${viewing.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: `${statusAction.action.charAt(0) + statusAction.action.slice(1).toLowerCase()} applied`, variant: "success" });
      setStatusAction(null);
      setViewOpen(false);
      loadStudents();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to update status", variant: "destructive" });
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Students</h2>
          <p className="text-muted-foreground">Manage all students in your school</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Import</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Bulk Import Students</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Paste CSV rows with headers: <code className="rounded bg-muted px-1">First Name, Last Name, Middle Name, Email, Phone, Gender, Date of Birth, Class, Admission Number</code>.
                  Leave the admission number empty to auto-generate.
                </p>
                <Textarea rows={8} value={importText} onChange={(e) => setImportText(e.target.value)}
                  placeholder={"First Name, Last Name, Email, Gender, Class\nAda, Okafor, ada@example.com, FEMALE, Primary 5"} />
                {importResult && (
                  <div className="rounded-lg border px-3 py-2 text-sm">
                    <span className="font-medium text-green-600">{importResult.created} created</span>
                    {importResult.failed > 0 && <span className="ml-2 font-medium text-destructive">{importResult.failed} failed</span>}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
                <Button onClick={handleImport} disabled={importing || !importText.trim()}>
                  {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</> : "Import"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" onClick={openCreate}>
                <UserPlus className="mr-2 h-4 w-4" /> Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Student" : "Add New Student"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>First Name *</Label><Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Middle Name</Label><Input value={formData.middleName} onChange={(e) => setFormData({ ...formData, middleName: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Last Name *</Label><Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Admission Number (auto if empty)</Label><Input value={formData.admissionNumber} onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })} placeholder="Auto-generated" /></div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Class</Label>
                    <Select value={formData.classId} onValueChange={(v) => setFormData({ ...formData, classId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Email (login)</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Blood Group</Label><Input value={formData.bloodGroup} onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })} placeholder="O+" /></div>
                  <div className="space-y-2"><Label>Religion</Label><Input value={formData.religion} onChange={(e) => setFormData({ ...formData, religion: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Nationality</Label><Input value={formData.nationality} onChange={(e) => setFormData({ ...formData, nationality: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>State</Label><Input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Local Govt</Label><Input value={formData.lga} onChange={(e) => setFormData({ ...formData, lga: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Home Address</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Emergency Contact Name</Label><Input value={formData.emergencyContactName} onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Emergency Contact Phone</Label><Input value={formData.emergencyContactPhone} onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Previous School</Label><Input value={formData.previousSchool} onChange={(e) => setFormData({ ...formData, previousSchool: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Parent Relation</Label><Input value={formData.parentRelation} onChange={(e) => setFormData({ ...formData, parentRelation: e.target.value })} placeholder="Father / Mother / Guardian" /></div>
                </div>
                <div className="space-y-2"><Label>Medical Notes</Label><Textarea rows={2} value={formData.medicalInfo} onChange={(e) => setFormData({ ...formData, medicalInfo: e.target.value })} /></div>
                <div className="space-y-2"><Label>Disabilities / Special Needs</Label><Input value={formData.disabilities} onChange={(e) => setFormData({ ...formData, disabilities: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editing ? "Save Changes" : "Save Student"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, admission number, or email..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="GRADUATED">Graduated</SelectItem>
            <SelectItem value="TRANSFERRED">Transferred</SelectItem>
            <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="hidden md:table-cell">Admission No.</TableHead>
                <TableHead className="hidden md:table-cell">Class</TableHead>
                <TableHead className="hidden lg:table-cell">Parent</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <UserPlus className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No students found</p>
                      <Button variant="outline" size="sm" onClick={openCreate}>Add your first student</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow key={student.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(`${student.firstName} ${student.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{student.firstName} {student.middleName ? `${student.middleName} ` : ""}{student.lastName}</p>
                          <p className="text-xs text-muted-foreground">{student.email || "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="font-mono text-xs">{student.admissionNumber}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{student.class?.name || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {student.parent ? `${student.parent.firstName} ${student.parent.lastName}` : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant={statusVariant(student.admissionStatus) as "success" | "destructive" | "info" | "warning" | "outline" | "secondary" | "default" | undefined}>
                        {student.admissionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`View ${student.firstName} ${student.lastName}`} onClick={() => handleView(student)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${student.firstName} ${student.lastName}`} onClick={() => openEdit(student)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <ConfirmDialog
                          title="Delete student?"
                          description={`${student.firstName} ${student.lastName} (${student.admissionNumber}) will be marked withdrawn and their login disabled.`}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${student.firstName} ${student.lastName}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                          onConfirm={() => handleDelete(student)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} students</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <span>Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* View dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Student Details
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIdCardOpen(true)}>
                <IdCard className="mr-1 h-3 w-3" /> ID Card
              </Button>
            </DialogTitle>
          </DialogHeader>
          {viewLoading || !viewing ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="grid gap-4 py-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(`${viewing.firstName} ${viewing.lastName}`)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{viewing.firstName} {viewing.middleName ? `${viewing.middleName} ` : ""}{viewing.lastName}</p>
                  <p className="text-sm text-muted-foreground">{viewing.admissionNumber}</p>
                </div>
                <Badge variant={statusVariant(viewing.admissionStatus) as "success" | "destructive" | "info" | "warning" | "outline" | "secondary" | "default" | undefined} className="ml-auto">
                  {viewing.admissionStatus}
                </Badge>
              </div>

              {/* Status actions */}
              <div className="flex flex-wrap gap-2">
                {viewing.admissionStatus === "ACTIVE" && (
                  <>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setStatusAction({ action: "SUSPEND", newClassId: "" })}>
                      <AlertTriangle className="mr-1 h-3 w-3" /> Suspend
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setStatusAction({ action: "GRADUATE", newClassId: "" })}>
                      <GraduationCap className="mr-1 h-3 w-3" /> Graduate
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setStatusAction({ action: "TRANSFER", newClassId: "" })}>
                      <ArrowRightLeft className="mr-1 h-3 w-3" /> Transfer
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setStatusAction({ action: "PROMOTE", newClassId: "" })}>
                      <ArrowUpCircle className="mr-1 h-3 w-3" /> Promote
                    </Button>
                  </>
                )}
                {viewing.admissionStatus !== "ACTIVE" && (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setStatusAction({ action: "REACTIVATE", newClassId: "" })}>
                    <RotateCcw className="mr-1 h-3 w-3" /> Reactivate
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><span className="text-muted-foreground">Class:</span> {viewing.class?.name ?? "—"}</div>
                <div><span className="text-muted-foreground">Gender:</span> {viewing.gender ?? "—"}</div>
                <div><span className="text-muted-foreground">Email:</span> {viewing.email ?? "—"}</div>
                <div><span className="text-muted-foreground">Phone:</span> {viewing.phone ?? "—"}</div>
                <div><span className="text-muted-foreground">DOB:</span> {viewing.dateOfBirth ? formatDate(viewing.dateOfBirth) : "—"}</div>
                <div><span className="text-muted-foreground">Blood Group:</span> {viewing.bloodGroup ?? "—"}</div>
                <div><span className="text-muted-foreground">Religion:</span> {viewing.religion ?? "—"}</div>
                <div><span className="text-muted-foreground">Nationality:</span> {viewing.nationality ?? "—"}</div>
                <div><span className="text-muted-foreground">State / LGA:</span> {viewing.state ?? "—"}{viewing.lga ? ` / ${viewing.lga}` : ""}</div>
                <div><span className="text-muted-foreground">Enrolled:</span> {formatDate(viewing.enrollmentDate)}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Parent:</span> {viewing.parent ? `${viewing.parent.firstName} ${viewing.parent.lastName}${viewing.parentRelation ? ` (${viewing.parentRelation})` : ""}` : "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Emergency Contact:</span> {viewing.emergencyContactName ? `${viewing.emergencyContactName}${viewing.emergencyContactPhone ? ` · ${viewing.emergencyContactPhone}` : ""}` : "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Previous School:</span> {viewing.previousSchool ?? "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {viewing.address ?? "—"}</div>
                {viewing.medicalInfo && <div className="col-span-2"><span className="text-muted-foreground">Medical Notes:</span> {viewing.medicalInfo}</div>}
                {viewing.disabilities && <div className="col-span-2"><span className="text-muted-foreground">Disabilities:</span> {viewing.disabilities}</div>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{viewing._count.attendances}</p><p className="text-xs text-muted-foreground">Attendance records</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{viewing._count.results}</p><p className="text-xs text-muted-foreground">Results</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{viewing.feeRecords.length}</p><p className="text-xs text-muted-foreground">Fee records</p></CardContent></Card>
              </div>

              {viewing.results.length > 0 && (
                <div>
                  <CardTitle className="text-sm mb-2">Recent results</CardTitle>
                  <div className="space-y-1">
                    {viewing.results.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2">
                        <span>{r.subject.name} <span className="text-muted-foreground">({r.term})</span></span>
                        <span><Badge variant="secondary">{r.grade ?? "—"}</Badge> {r.total ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewing.timeline && viewing.timeline.length > 0 && (
                <div>
                  <CardTitle className="text-sm mb-2 flex items-center gap-1"><History className="h-4 w-4" /> Timeline</CardTitle>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {viewing.timeline.map((t) => (
                      <div key={t.id} className="flex items-start justify-between rounded-lg border px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{t.event}</p>
                          {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDate(t.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status action dialog (transfer/promote need a target class) */}
      <Dialog open={!!statusAction} onOpenChange={(open) => !open && setStatusAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{statusAction?.action === "PROMOTE" ? "Promote student" : statusAction?.action === "TRANSFER" ? "Transfer student" : "Confirm action"}</DialogTitle>
          </DialogHeader>
          {(statusAction?.action === "PROMOTE" || statusAction?.action === "TRANSFER") && (
            <div className="space-y-2 py-2">
              <Label>Target class</Label>
              <Select value={statusAction.newClassId} onValueChange={(v) => setStatusAction({ ...statusAction, newClassId: v })}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {statusAction?.action === "SUSPEND" && "The student's login will be disabled until reactivated."}
            {statusAction?.action === "GRADUATE" && "The student will be marked as graduated."}
            {statusAction?.action === "REACTIVATE" && "The student's account will be re-enabled."}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStatusAction(null)}>Cancel</Button>
            <Button onClick={applyStatusAction} disabled={statusBusy || ((statusAction?.action === "PROMOTE" || statusAction?.action === "TRANSFER") && !statusAction?.newClassId)}>
              {statusBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working...</> : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ID card dialog */}
      <Dialog open={idCardOpen} onOpenChange={setIdCardOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Student ID Card</DialogTitle></DialogHeader>
          {viewing && (
            <div className="rounded-xl border-2 border-primary p-6 text-center space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <AvatarFallback className="text-lg bg-transparent text-primary">{getInitials(`${viewing.firstName} ${viewing.lastName}`)}</AvatarFallback>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{schoolName || "EduFlow School"}</p>
                <p className="font-bold text-lg">{viewing.firstName} {viewing.middleName ? `${viewing.middleName} ` : ""}{viewing.lastName}</p>
                <p className="text-xs text-muted-foreground">{viewing.class?.name ?? "Not assigned"} · {viewing.gender ?? ""}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Admission Number</p>
                <p className="font-mono font-bold">{viewing.admissionNumber}</p>
              </div>
              <Badge variant={statusVariant(viewing.admissionStatus) as "success" | "destructive" | "info" | "warning" | "outline" | "secondary" | "default" | undefined}>
                {viewing.admissionStatus}
              </Badge>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* One-time credentials */}
      <CredentialsDialog
        open={!!creds}
        onOpenChange={(open) => !open && setCreds(null)}
        email={creds?.email ?? ""}
        tempPassword={creds?.tempPassword ?? ""}
      />
    </div>
  );
}
