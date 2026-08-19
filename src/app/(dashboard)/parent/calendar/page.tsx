"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarRange, CalendarDays, GraduationCap, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildSelect } from "@/components/portal/child-select";
import { useChildren } from "@/hooks/use-children";
import { formatDate } from "@/lib/utils";

type CalendarData = {
  child: { firstName: string; lastName: string; className: string | null };
  events: { id: string; title: string; description: string | null; type: string; eventDate: string; startTime: string | null; endTime: string | null }[];
  exams: { id: string; name: string; type: string; startDate: string | null; endDate: string | null; sessionName: string; termName: string }[];
};

export default function ParentCalendarPage() {
  const { children, selectedId, setSelectedId, loading } = useChildren();
  const [data, setData] = useState<CalendarData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const load = useCallback(async (childId: string) => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/parent/${childId}/calendar`);
      const d = await parseJsonBody(res);
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
            <CalendarRange className="h-6 w-6 text-primary" /> School Calendar
          </h2>
          <p className="text-muted-foreground">Upcoming events and examinations</p>
        </div>
        <ChildSelect children={children} selectedId={selectedId} onSelect={setSelectedId} loading={loading} />
      </div>

      {dataLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : !data ? (
        <p className="text-muted-foreground">No calendar data available.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Upcoming events</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No upcoming events.</p>
              ) : (
                data.events.map((e) => (
                  <div key={e.id} className="flex gap-3 rounded-lg border p-3">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <span className="text-sm font-bold">{new Date(e.eventDate).getDate()}</span>
                      <span className="text-[10px] uppercase">{new Date(e.eventDate).toLocaleString("en", { month: "short" })}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{e.title}</p>
                      {e.description && <p className="text-xs text-muted-foreground line-clamp-1">{e.description}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {e.startTime ? `${e.startTime}${e.endTime ? ` – ${e.endTime}` : ""}` : formatDate(e.eventDate)} · {e.type}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Upcoming exams</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.exams.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No active examinations for this class.</p>
              ) : (
                data.exams.map((x) => (
                  <div key={x.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{x.name}</p>
                      <p className="text-xs text-muted-foreground">{x.sessionName} · {x.termName} Term</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary">{x.type.replace(/_/g, " ")}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {x.startDate ? formatDate(x.startDate) : "TBA"}{x.endDate ? ` – ${formatDate(x.endDate)}` : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
