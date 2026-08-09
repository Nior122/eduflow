"use client";

import { useCallback, useEffect, useState } from "react";
import { NotebookPen, CheckCircle2, Clock, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChildSelect } from "@/components/portal/child-select";
import { useChildren } from "@/hooks/use-children";
import { formatDate } from "@/lib/utils";

type WorkItem = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  subject: string;
  submission: { id: string; submittedAt: string; grade: number | null; feedback: string | null } | null;
};

type SchoolworkData = {
  child: { firstName: string; lastName: string; className: string | null };
  assignments: WorkItem[];
  homework: WorkItem[];
};

function WorkCard({ w, kind }: { w: WorkItem; kind: "assignment" | "homework" }) {
  const overdue = new Date(w.dueDate).getTime() < Date.now() && !w.submission;
  return (
    <Card className={overdue ? "border-destructive/40" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{w.title}</p>
            <p className="text-xs text-muted-foreground">{w.subject} · Due {formatDate(w.dueDate)}</p>
          </div>
          {w.submission?.grade != null ? (
            <Badge className="bg-emerald-500/15 text-emerald-600">Graded: {w.submission.grade}</Badge>
          ) : w.submission ? (
            <Badge className="bg-primary/10 text-primary"><CheckCircle2 className="mr-1 h-3 w-3" /> Submitted</Badge>
          ) : overdue ? (
            <Badge className="bg-destructive/15 text-destructive"><Clock className="mr-1 h-3 w-3" /> Overdue</Badge>
          ) : (
            <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>
          )}
        </div>
        {w.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{w.description}</p>}
        {w.submission?.feedback && (
          <div className="mt-3 rounded-lg bg-muted/50 p-2.5 text-sm">
            <span className="font-medium flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Teacher feedback: </span>
            {w.submission.feedback}
          </div>
        )}
        {w.submission && (
          <p className="mt-2 text-xs text-muted-foreground">
            Submitted {formatDate(w.submission.submittedAt)}
            {kind === "homework" ? " — homework" : " — assignment"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ParentSchoolworkPage() {
  const { children, selectedId, setSelectedId, loading } = useChildren();
  const [data, setData] = useState<SchoolworkData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const load = useCallback(async (childId: string) => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/parent/${childId}/schoolwork`);
      const d = await res.json();
      if (res.ok) setData(d);
    } catch {
      /* ignore */
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) load(selectedId);
  }, [selectedId, load]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <NotebookPen className="h-6 w-6 text-primary" /> School Work
          </h2>
          <p className="text-muted-foreground">Assignments & homework with submission status</p>
        </div>
        <ChildSelect children={children} selectedId={selectedId} onSelect={setSelectedId} loading={loading} />
      </div>

      {dataLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : !data ? (
        <p className="text-muted-foreground">No school work available.</p>
      ) : (
        <Tabs defaultValue="assignments">
          <TabsList>
            <TabsTrigger value="assignments">Assignments ({data.assignments.length})</TabsTrigger>
            <TabsTrigger value="homework">Homework ({data.homework.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="assignments" className="mt-4 space-y-3">
            {data.assignments.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center">No assignments for this class yet.</p>
            ) : (
              data.assignments.map((a) => <WorkCard key={a.id} w={a} kind="assignment" />)
            )}
          </TabsContent>
          <TabsContent value="homework" className="mt-4 space-y-3">
            {data.homework.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center">No homework for this class yet.</p>
            ) : (
              data.homework.map((h) => <WorkCard key={h.id} w={h} kind="homework" />)
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
