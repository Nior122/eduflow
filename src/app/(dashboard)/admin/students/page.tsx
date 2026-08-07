"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Search, Pencil, Trash2, Eye, UserPlus, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getInitials, formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CredentialsDialog } from "@/components/credentials-dialog";

type Class = { id: string; name: string; category: string };

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  admissionNumber: string;
  gender: string | null;
  dateOfBirth: string | null;
  address: string | null;
  enrollmentDate: string;
  class: { id: string; name: string } | null;
  parent: { id: string; firstName: string; lastName: string } | null;
  _count: { attendances: number; results: number };
};

type StudentDetail = Student & {
  class: { id: string; name: string; section: string | null } | null;
  results: { id: string; subject: { name: string }; total: string | null; grade: string | null; term: string }[];
  feeRecords: { id: string; fee: { name: string }; amount: string; status: string }[];
};

const EMPTY_FORM = {
  firstName: "", lastName: "", email: "", phone: "", gender: "",
  admissionNumber: "", classId: "", dateOfBirth: "", address: "",
};

const LIMIT = 25;

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
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

  const loadStudents = useCallback(async () => {
    const params = new URLSearchParams();
    if (classFilter && classFilter !== "all") params.set("classId", classFilter);
    if (search) params.set("search", search);
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
  }, [search, classFilter, page]);

  useEffect(() => {
    loadStudents();
    fetch("/api/admin/classes").then(r => r.ok && r.json()).then(d => d?.classes && setClasses(d.classes)).catch(() => {});
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
      lastName: student.lastName,
      email: student.email ?? "",
      phone: student.phone ?? "",
      gender: student.gender ?? "",
      admissionNumber: student.admissionNumber,
      classId: student.class?.id ?? "",
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().slice(0, 10) : "",
      address: student.address ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName || !formData.admissionNumber) {
      return toast({ title: "Name and admission number are required", variant: "destructive" });
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Students</h2>
          <p className="text-muted-foreground">Manage all students in your school</p>
        </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Admission Number *</Label>
                  <Input value={formData.admissionNumber} onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })} />
                </div>
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
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={formData.classId} onValueChange={(v) => setFormData({ ...formData, classId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email (used for login)</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="student@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>
              </div>
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
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
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
                <TableHead className="hidden lg:table-cell">Enrolled</TableHead>
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
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
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
                          <p className="font-medium text-sm">{student.firstName} {student.lastName}</p>
                          <p className="text-xs text-muted-foreground">{student.email || "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="font-mono text-xs">{student.admissionNumber}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {student.class?.name || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {student.parent ? `${student.parent.firstName} ${student.parent.lastName}` : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {formatDate(student.enrollmentDate)}
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
                          description={`${student.firstName} ${student.lastName} (${student.admissionNumber}) will be deactivated and their login disabled.`}
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
          <p>
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} students
          </p>
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
            <DialogTitle>Student Details</DialogTitle>
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
                  <p className="font-semibold">{viewing.firstName} {viewing.lastName}</p>
                  <p className="text-sm text-muted-foreground">{viewing.admissionNumber}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><span className="text-muted-foreground">Class:</span> {viewing.class?.name ?? "—"}{viewing.class?.section ? ` (${viewing.class.section})` : ""}</div>
                <div><span className="text-muted-foreground">Gender:</span> {viewing.gender ?? "—"}</div>
                <div><span className="text-muted-foreground">Email:</span> {viewing.email ?? "—"}</div>
                <div><span className="text-muted-foreground">Phone:</span> {viewing.phone ?? "—"}</div>
                <div><span className="text-muted-foreground">DOB:</span> {viewing.dateOfBirth ? formatDate(viewing.dateOfBirth) : "—"}</div>
                <div><span className="text-muted-foreground">Enrolled:</span> {formatDate(viewing.enrollmentDate)}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Parent:</span> {viewing.parent ? `${viewing.parent.firstName} ${viewing.parent.lastName}` : "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {viewing.address ?? "—"}</div>
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
