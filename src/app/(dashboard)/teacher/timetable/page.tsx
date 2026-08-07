"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock } from "lucide-react";

type TimetableEntry = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  class: { id: string; name: string };
  subject: { id: string; name: string; code: string | null };
  classroom: { id: string; name: string; roomNumber: string | null } | null;
};

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_LABEL = (d: string) => d.charAt(0) + d.slice(1).toLowerCase();

export default function TeacherTimetablePage() {
  const { data: session } = useSession();
  const [byDay, setByDay] = useState<Record<string, TimetableEntry[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const teacherId = session?.user?.teacherId;
    if (!teacherId) return;
    fetch(`/api/admin/timetable?teacherId=${teacherId}`)
      .then((r) => r.ok && r.json())
      .then((d) => {
        const grouped: Record<string, TimetableEntry[]> = {};
        for (const day of DAYS) grouped[day] = [];
        (d?.entries ?? []).forEach((e: TimetableEntry) => {
          if (!grouped[e.day]) grouped[e.day] = [];
          grouped[e.day].push(e);
        });
        for (const day of DAYS) grouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
        setByDay(grouped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.user?.teacherId]);

  if (loading) return <div className="space-y-6"><Skeleton className="h-64" /></div>;

  const today = DAYS[new Date().getDay()] ?? "MONDAY";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-primary" /> My Timetable
        </h2>
        <p className="text-muted-foreground">Your weekly teaching schedule</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DAYS.map((day) => {
          const entries = byDay[day] ?? [];
          const isToday = day === today;
          return (
            <Card key={day} className={isToday ? "border-primary/50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  {DAY_LABEL(day)}
                  {isToday && <Badge variant="success">Today</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No lessons</p>
                ) : entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{e.subject.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.class.name}{e.classroom ? ` · ${e.classroom.name}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">{e.startTime}–{e.endTime}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
