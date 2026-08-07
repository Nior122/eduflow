"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { NotebookPen, Loader2, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

type Homework = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  subject: { id: string; name: string };
  teacher: { id: string; firstName: string; lastName: string } | null;
  submissions: { id: string; grade: number | null; submittedAt: string; feedback: string | null }[];
};

export default function StudentHomeworkPage() {
  const [items, setItems] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitFor, setSubmitFor] = useState<Homework | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    fetch("/api/homework")
      .then((r) => r.ok && r.json())
      .then((d) => d?.homework && setItems(d.homework))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async () => {
    if (!submitFor || !content.trim()) return toast({ title: "Write something to submit", variant: "destructive" });
    setSubmitting(true);
    try {
      const res = await fetch(`/api/homework/${submitFor.id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Homework submitted", variant: "success" });
      setSubmitFor(null);
      setContent("");
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to submit", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const mine = (h: Homework) => (h.submissions ?? [])[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <NotebookPen className="h-6 w-6 text-primary" /> Homework
        </h2>
        <p className="text-muted-foreground">Submit your homework before the deadline</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />) :
          items.length === 0 ? (
            <Card className="md:col-span-2"><CardContent className="py-12 text-center">
              <NotebookPen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No homework for your class yet</p>
            </CardContent></Card>
          ) : items.map((h) => {
            const my = mine(h);
            const overdue = new Date(h.dueDate) < new Date();
            return (
              <Card key={h.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{h.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {h.subject.name} · due {formatDate(h.dueDate)}
                        {h.teacher ? ` · ${h.teacher.firstName} ${h.teacher.lastName}` : ""}
                      </p>
                    </div>
                    {my ? (
                      my.grade != null ? <Badge variant="success">Score: {my.grade}</Badge> : <Badge variant="info">Submitted</Badge>
                    ) : overdue ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {h.description && <p className="text-sm text-muted-foreground line-clamp-2">{h.description}</p>}
                  {my?.feedback && (
                    <div className="rounded-lg bg-muted/50 p-2 text-sm">
                      <span className="font-medium">Feedback: </span>{my.feedback}
                    </div>
                  )}
                  <Button
                    variant={my ? "outline" : "gradient"}
                    size="sm"
                    className="w-full"
                    disabled={!!my?.grade}
                    onClick={() => setSubmitFor(h)}
                  >
                    <Send className="mr-1 h-4 w-4" />
                    {my ? (my.grade != null ? "Reviewed — closed" : "Update Submission") : "Submit"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Submit dialog */}
      <Dialog open={!!submitFor} onOpenChange={(open) => !open && setSubmitFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit — {submitFor?.title}</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Your work</Label>
            <Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your homework here..." />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setSubmitFor(null)}>Cancel</Button>
            <Button variant="gradient" onClick={handleSubmit} disabled={submitting || !content.trim()}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
