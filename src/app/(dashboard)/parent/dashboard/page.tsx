"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, BookOpen, DollarSign, TrendingUp } from "lucide-react";
import { getInitials, formatDate, formatCurrency } from "@/lib/utils";

type ChildData = {
  id: string; firstName: string; lastName: string; admissionNumber: string; class: { name: string } | null;
  attendances: { status: string; date: string }[];
  results: { subject: { name: string }; total: string; grade: string; term: string }[];
  feeRecords: { fee: { name: string; amount: string }; amount: string; status: string }[];
};

export default function ParentDashboardPage() {
  const [children, setChildren] = useState<ChildData[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/parent/dashboard")
      .then(r => r.ok && r.json())
      .then(d => {
        const kids = d?.children ?? [];
        setChildren(kids);
        if (kids.length > 0) setSelectedId(kids[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-6"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  if (children.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20">
      <User className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No Child Linked</h3>
      <p className="text-muted-foreground">Please contact the school to link your child&apos;s profile.</p>
    </div>
  );

  const child = children.find((c) => c.id === selectedId) ?? children[0];

  const attendanceRate = child.attendances.length > 0
    ? Math.round((child.attendances.filter(a => a.status === "PRESENT").length / child.attendances.length) * 100) : 0;

  const avgScore = child.results.length > 0
    ? Math.round(child.results.reduce((s, r) => s + parseFloat(r.total), 0) / child.results.length) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg bg-primary/10 text-primary">{getInitials(`${child.firstName} ${child.lastName}`)}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold">{child.firstName} {child.lastName}</h2>
            <p className="text-muted-foreground">{child.class?.name || "Not assigned"} · {child.admissionNumber}</p>
          </div>
        </div>
        {children.length > 1 && (
          <div className="sm:ml-auto w-full sm:w-64">
            <Select value={child.id} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
              <SelectContent>
                {children.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Attendance Rate" value={`${attendanceRate}%`} icon={TrendingUp} />
        <StatCard title="Average Score" value={`${avgScore}%`} icon={BookOpen} />
        <StatCard title="Fee Status" value={`${child.feeRecords.filter(f => f.status === "PAID").length}/${child.feeRecords.length} paid`} icon={DollarSign} />
      </div>

      <Tabs defaultValue="results" className="space-y-4">
        <TabsList>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="results">
          <Card><CardHeader><CardTitle className="text-lg">Academic Results</CardTitle></CardHeader><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Term</TableHead><TableHead>Total</TableHead><TableHead>Grade</TableHead></TableRow></TableHeader>
            <TableBody>
              {child.results.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No results available</TableCell></TableRow> :
                child.results.map((r, i) => (
                  <TableRow key={i}><TableCell>{r.subject.name}</TableCell><TableCell>{r.term} Term</TableCell><TableCell className="font-bold">{r.total}</TableCell>
                    <TableCell><Badge variant={parseFloat(r.total) >= 75 ? "success" : parseFloat(r.total) >= 55 ? "warning" : "destructive"}>{r.grade}</Badge></TableCell></TableRow>
                ))
              }
            </TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card><CardHeader><CardTitle className="text-lg">Attendance History</CardTitle></CardHeader><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {child.attendances.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No attendance records</TableCell></TableRow> :
                child.attendances.slice(0, 30).map((a, i) => (
                  <TableRow key={i}><TableCell>{formatDate(a.date)}</TableCell>
                    <TableCell><Badge variant={a.status === "PRESENT" ? "success" : a.status === "LATE" ? "warning" : "destructive"}>{a.status}</Badge></TableCell></TableRow>
                ))
              }
            </TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fees">
          <Card><CardHeader><CardTitle className="text-lg">Fee Records</CardTitle></CardHeader><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Fee</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {child.feeRecords.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No fee records</TableCell></TableRow> :
                child.feeRecords.map((f, i) => (
                  <TableRow key={i}><TableCell>{f.fee.name}</TableCell><TableCell>{formatCurrency(f.amount)}</TableCell>
                    <TableCell><Badge variant={f.status === "PAID" ? "success" : "warning"}>{f.status}</Badge></TableCell></TableRow>
                ))
              }
            </TableBody></Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
