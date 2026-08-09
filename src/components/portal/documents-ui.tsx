"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FolderOpen,
  FileText,
  FileUp,
  Download,
  Loader2,
  Search,
  Trash2,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  Presentation,
  ClipboardList,
  ScrollText,
  BookOpen,
  ShieldCheck,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type DocumentItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  audience: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string | null;
  uploader: { id: string; name: string } | null;
  createdAt: string;
};

const CATEGORIES: { value: string; label: string; icon: React.ElementType }[] = [
  { value: "HANDBOOK", label: "Handbooks", icon: BookOpen },
  { value: "POLICY", label: "Policies", icon: ShieldCheck },
  { value: "TIMETABLE", label: "Timetables", icon: ClipboardList },
  { value: "STUDY_MATERIAL", label: "Study Materials", icon: FileText },
  { value: "FORM", label: "Forms", icon: FileSpreadsheet },
  { value: "CIRCULAR", label: "Circulars", icon: ScrollText },
  { value: "PAST_QUESTION", label: "Past Questions", icon: FileText },
  { value: "OTHER", label: "Other", icon: FolderOpen },
];

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: "Everyone",
  TEACHERS: "Teachers",
  PARENTS: "Parents",
  STUDENTS: "Students",
  STAFF: "Staff",
};

const FILE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  ppt: Presentation,
  pptx: Presentation,
  zip: FileArchive,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  png: ImageIcon,
};

function fileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? Paperclip;
}

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function DocumentsUI({ canUpload = false }: { canUpload?: boolean }) {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("ALL");
  const [q, setQ] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [docCategory, setDocCategory] = useState("OTHER");
  const [audience, setAudience] = useState("ALL");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "ALL") params.set("category", category);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/documents?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data?.documents) setItems(data.documents);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [category, q]);

  useEffect(() => {
    load();
  }, [load]);

  const submitUpload = async () => {
    if (!title.trim()) return toast({ title: "Title is required", variant: "destructive" });
    if (!file) return toast({ title: "Choose a file to upload", variant: "destructive" });
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title.trim());
      form.append("description", description.trim());
      form.append("category", docCategory);
      form.append("audience", audience);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      toast({ title: "Document uploaded", variant: "success" });
      setUploadOpen(false);
      setTitle("");
      setDescription("");
      setFile(null);
      setDocCategory("OTHER");
      setAudience("ALL");
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (d: DocumentItem) => {
    try {
      const res = await fetch(`/api/documents/${d.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Document deleted" });
        load();
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" /> School Documents
          </h2>
          <p className="text-muted-foreground">Handbooks, policies, materials and forms — sorted by your role</p>
        </div>
        {canUpload && (
          <Button variant="gradient" onClick={() => setUploadOpen(true)}>
            <FileUp className="mr-1 h-4 w-4" /> Upload Document
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search documents…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-semibold">No documents found</h3>
          <p className="text-muted-foreground text-sm">Try a different category or search.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d) => {
            const Icon = fileIcon(d.fileName);
            return (
              <Card key={d.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold line-clamp-1">{d.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{d.description ?? "No description"}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant="secondary">{CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category}</Badge>
                    <Badge variant="secondary">{AUDIENCE_LABELS[d.audience] ?? d.audience}</Badge>
                    <span className="text-muted-foreground">{formatSize(d.fileSize)}</span>
                    <span className="text-muted-foreground">{formatDate(d.createdAt)}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 pt-3 border-t">
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="flex-1">
                      <Button variant="gradient" size="sm" className="w-full">
                        <Download className="mr-1 h-4 w-4" /> Download
                      </Button>
                    </a>
                    {canUpload && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(d)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 2025/2026 School Handbook" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={docCategory} onValueChange={setDocCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Visible to</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Everyone</SelectItem>
                    <SelectItem value="TEACHERS">Teachers</SelectItem>
                    <SelectItem value="PARENTS">Parents</SelectItem>
                    <SelectItem value="STUDENTS">Students</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>File (max 10 MB)</Label>
              <label className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer hover:bg-accent/40 transition-colors",
                file && "border-primary/50 bg-primary/5"
              )}>
                <FileUp className="h-8 w-8 text-muted-foreground" />
                {file ? (
                  <p className="text-sm font-medium">{file.name} ({formatSize(file.size)})</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Click to choose a file</p>
                )}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={submitUpload} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
