"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildSelect } from "@/components/portal/child-select";
import { useChildren } from "@/hooks/use-children";

type TimetableData = {
  child: { firstName: string; lastName: string; className: string | null };
  days: { day: string; entries: { id: string; startTime: string; endTime: string; subject: string; teacher: string | null }[] }[];
};

export default function ParentTimetablePage() {
  const { children, selectedId, setSelectedId, loading } = useChildren();
  const [data, setData] = useState<TimetableData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const load = useCallback(async (childId: string) => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/parent/${childId}/timetable`);
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
            <CalendarClock className="h-6 w-6 text-primary" /> Timetable
          </h2>
          <p className="text-muted-foreground">
            {data?.child ? `${data.child.firstName}'s weekly class schedule` : "Weekly class schedule"}
          </p>
        </div>
        <ChildSelect children={children} selectedId={selectedId} onSelect={setSelectedId} loading={loading} />
      </div>

      {dataLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : !data ? (
        <p className="text-muted-foreground">No timetable data available.</p>
      ) : data.days.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarClock className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-semibold">No timetable published</h3>
          <p className="text-muted-foreground text-sm">The school has not published a timetable for this class yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.days.map((d) => (
            <Card key={d.day}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm capitalize">{d.day.toLowerCase()}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {d.entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.subject}</p>
                      <p className="text-xs text-muted-foreground">{e.teacher ?? "—"}</p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                      {e.startTime}–{e.endTime}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
