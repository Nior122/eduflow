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
import { Plus, Users, Pencil, Trash2, Loader2, Mail, Phone, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CredentialsDialog } from "@/components/credentials-dialog";

type ParentItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  occupation: string | null;
  address: string | null;
  _count: { children: number };
  children: { id: string; firstName: string; lastName: string; admissionNumber: string }[];
};

type StudentOption = { id: string; firstName: string; lastName: string; admissionNumber: string };

const EMPTY_FORM = {
  firstName: "", lastName: "", email: "", phone: "", occupation: "", address: "", studentIds: [] as string[],
};

export default function ParentsPage() {
  const [parents, setParents] = useState<ParentItem[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ParentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [creds, setCreds] = useState<{ email: string; tempPassword: string } | null>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    return fetch(`/api/admin/parents?${params}`)
      .then((r) => r.ok && r.json())
      .then((d) => d?.parents && setParents(d.parents))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch("/api/admin/students?limit=100")
      .then((r) => r.ok && r.json())
      .then((d) => d?.students && setStudents(d.students))
      .catch(() => {});
  }, [search]);

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: ParentItem) => {
    setEditing(p);
    setFormData({
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone ?? "",
      occupation: p.occupation ?? "",
      address: p.address ?? "",
      studentIds: p.children.map((c) => c.id),
    });
    setDialogOpen(true);
  };

  const toggleStudent = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      studentIds: prev.studentIds.includes(id)
        ? prev.studentIds.filter((s) => s !== id)
        : [...prev.studentIds, id],
    }));
  };

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      return toast({ title: "Name and email are required", variant: "destructive" });
    }
    setSaving(true);
    try {
      const res = editing
        ? await fetch(`/api/admin/parents/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          })
        : await fetch("/api/admin/parents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: editing ? "Parent updated" : "Parent added", variant: "success" });
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
      if (!editing && data.credentials) {
        setCreds({ email: data.credentials.email, tempPassword: data.credentials.tempPassword });
      }
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save parent", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: ParentItem) => {
    try {
      const res = await fetch(`/api/admin/parents/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Parent deleted", variant: "success" });
      load();
    } catch {
      toast({ title: "Failed to delete parent", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Parents / Guardians</h2>
          <p className="text-muted-foreground">Manage parents and link them to their children</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Parent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Parent" : "Add Parent"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>First Name *</Label><Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} /></div>
                <div className="space-y-2"><Label>Last Name *</Label><Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Email (used for login) *</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>Occupation</Label><Input value={formData.occupation} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Address</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Linked Children</Label>
                {students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students yet — add students first.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-lg border p-2 space-y-1">
                    {students.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.studentIds.includes(s.id)}
                          onChange={() => toggleStudent(s.id)}
                          className="h-4 w-4 rounded border-input"
                        />
                        {s.firstName} {s.lastName} <span className="text-muted-foreground text-xs">({s.admissionNumber})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editing ? "Save Changes" : "Save Parent"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search parents..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parent</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden md:table-cell">Occupation</TableHead>
                <TableHead>Children</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                </TableRow>
              )) : parents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No parents yet</p>
                  </TableCell>
                </TableRow>
              ) : parents.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(`${p.firstName} ${p.lastName}`)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{p.firstName} {p.lastName}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {p.email}</span>
                      {p.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {p.phone}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{p.occupation || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.children.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None linked</span>
                      ) : (
                        p.children.slice(0, 2).map((c) => (
                          <Badge key={c.id} variant="secondary" className="text-xs">{c.firstName} {c.lastName}</Badge>
                        ))
                      )}
                      {p.children.length > 2 && <Badge variant="outline" className="text-xs">+{p.children.length - 2}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${p.firstName} ${p.lastName}`} onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        title="Delete parent?"
                        description={`${p.firstName} ${p.lastName} will be deactivated and their login disabled.`}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${p.firstName} ${p.lastName}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        onConfirm={() => handleDelete(p)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CredentialsDialog
        open={!!creds}
        onOpenChange={(open) => !open && setCreds(null)}
        email={creds?.email ?? ""}
        tempPassword={creds?.tempPassword ?? ""}
      />
    </div>
  );
}
