"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, CalendarCheck2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, getAttendanceColor } from "@/lib/utils";

type AttendanceData = {
  rate: number;
  records: { id: string; date: string; status: string }[];
  byStatus: Record<string, number>;
};

export default function StudentAttendancePage() {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/attendance")
      .then((r) => parseJsonBody(r))
      .then((d) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" /> My Attendance
        </h2>
        <p className="text-muted-foreground">Your attendance over the last 90 days</p>
      </div>

      {!data ? (
        <p className="text-muted-foreground">No attendance data yet.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Attendance rate</p>
                <p className="mt-1 text-3xl font-bold">{data.rate}%</p>
                <Progress value={data.rate} className="mt-3" />
              </CardContent>
            </Card>
            {Object.entries(data.byStatus).map(([status, count]) => (
              <Card key={status}>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">{status}</p>
                  <p className="mt-1 text-3xl font-bold">{count}</p>
                  <Badge className={getAttendanceColor(status)}>{status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.records.length === 0 ? (
                    <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No attendance records yet</TableCell></TableRow>
                  ) : (
                    data.records.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="flex items-center gap-2"><CalendarCheck2 className="h-4 w-4 text-muted-foreground" /> {formatDate(r.date)}</TableCell>
                        <TableCell><Badge className={getAttendanceColor(r.status)}>{r.status}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
