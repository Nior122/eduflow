"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Printer, ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { gradeBadgeVariant, gradeColor } from "@/lib/exams/grades";

type ReportCardData = {
  reportCardId: string;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string; profileImage: string | null; gender: string | null };
  school: { name: string; motto: string | null; logo: string | null; address: string | null; principal: string | null };
  sessionName: string;
  termName: string;
  className: string;
  attendance: { present: number; absent: number; late: number; excused: number; total: number; rate: number };
  results: {
    subjectId: string; subjectName: string; caScore: number; examScore: number;
    total: number; grade: string; remark: string; subjectPosition: number | null; totalStudents: number | null;
  }[];
  overallAverage: number;
  overallGrade: string;
  classPosition: number | null;
  totalStudents: number | null;
  promotionStatus: string;
  classTeacherComment: string | null;
  principalComment: string | null;
  verificationCode: string;
  isPublished: boolean;
  publishedAt: string | null;
};

export default function ReportCardPrintPage() {
  const params = useParams<{ id: string }>();
  const [card, setCard] = useState<ReportCardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/report-cards/${params.id}`)
      .then(async (r) => {
        const data = await parseJsonBody(r);
        if (!r.ok) throw new Error(data.error || "Report card not found");
        return data;
      })
      .then((data) => setCard(data.reportCard))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [params.id]);

  const verifyCode = async () => {
    if (!card) return;
    try {
      const res = await fetch(`/api/report-cards/verify?code=${card.verificationCode}`);
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Verification failed");
      toast({ title: `Verified: ${data.studentName} · ${data.className} · avg ${data.overallAverage}` });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Verification failed", variant: "destructive" });
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center space-y-3">
          <p className="font-semibold text-destructive">{error}</p>
          <Link href="/"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" /> Back to app</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 p-4 sm:p-8 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto space-y-4 print:space-y-0">
        {/* Toolbar (hidden when printing) */}
        <div className="flex items-center justify-between print:hidden">
          <Link href="/">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={verifyCode} disabled={!card}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Verify QR code
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Print / Save PDF
            </Button>
          </div>
        </div>

        {!card ? (
          <Card className="p-12 space-y-3">
            <Skeleton className="h-6 w-1/2 mx-auto" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
          </Card>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border print:shadow-none print:border print:rounded-none">
            {/* Header */}
            <div className="border-b-4 border-primary px-6 py-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {card.school.logo ? <img src={card.school.logo} alt="" className="h-full w-full object-contain" /> : "🎓"}
                </div>
                <div>
                  <h1 className="text-xl font-bold">{card.school.name}</h1>
                  <p className="text-xs text-muted-foreground">{card.school.address ?? ""}</p>
                  <p className="text-xs italic text-muted-foreground">{card.school.motto ?? ""}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">REPORT CARD</p>
                <p className="text-xs text-muted-foreground">{card.sessionName} · Term {card.termName}</p>
                <Badge variant={card.isPublished ? "success" : "secondary"} className="mt-1">
                  {card.isPublished ? "Published" : "Draft"}
                </Badge>
              </div>
            </div>

            {/* Student info */}
            <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Student</p>
                <p className="font-semibold text-sm">{card.student.firstName} {card.student.lastName}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Admission No</p>
                <p className="font-mono text-sm">{card.student.admissionNumber}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Class</p>
                <p className="text-sm">{card.className}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Attendance</p>
                <p className="text-sm">{card.attendance.rate.toFixed(0)}% ({card.attendance.present}/{card.attendance.total} days)</p>
              </div>
            </div>

            {/* Scores */}
            <div className="px-6 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
                    <th className="py-2">Subject</th>
                    <th className="py-2 text-right">CA (40%)</th>
                    <th className="py-2 text-right">Exam (60%)</th>
                    <th className="py-2 text-right">Total</th>
                    <th className="py-2 text-center">Grade</th>
                    <th className="py-2 text-right">Position</th>
                    <th className="py-2">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {card.results.map((r) => (
                    <tr key={r.subjectId} className="border-b border-dashed">
                      <td className="py-2 font-medium">{r.subjectName}</td>
                      <td className="py-2 text-right">{r.caScore.toFixed(1)}</td>
                      <td className="py-2 text-right">{r.examScore.toFixed(1)}</td>
                      <td className="py-2 text-right font-bold">{r.total.toFixed(1)}</td>
                      <td className="py-2 text-center">
                        <Badge variant={gradeBadgeVariant(r.grade)} className={gradeColor(r.grade)}>{r.grade}</Badge>
                      </td>
                      <td className="py-2 text-right">{r.subjectPosition ? `${r.subjectPosition}/${r.totalStudents}` : "—"}</td>
                      <td className="py-2 text-xs">{r.remark}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-primary">
                    <td className="py-2 font-semibold">OVERALL</td>
                    <td colSpan={2} />
                    <td className="py-2 text-right font-bold text-lg">{card.overallAverage.toFixed(2)}</td>
                    <td className="py-2 text-center">
                      <Badge variant={gradeBadgeVariant(card.overallGrade)} className={gradeColor(card.overallGrade)}>{card.overallGrade}</Badge>
                    </td>
                    <td className="py-2 text-right font-semibold">
                      {card.classPosition ? `${card.classPosition}${ordinal(card.classPosition)} of ${card.totalStudents}` : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Comments & signatures */}
            <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Class teacher&apos;s comment</p>
                <p className="text-xs italic min-h-[3rem]">{card.classTeacherComment ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground mt-3">________________________</p>
                <p className="text-[10px] text-muted-foreground">Class Teacher&apos;s Signature</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Principal&apos;s comment</p>
                <p className="text-xs italic min-h-[3rem]">{card.principalComment ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground mt-3">________________________</p>
                <p className="text-[10px] text-muted-foreground">
                  Principal&apos;s Signature {card.school.principal ? `· ${card.school.principal}` : ""}
                </p>
              </div>
            </div>

            {/* Promotion + verification */}
            <div className="px-6 py-4 flex items-center justify-between border-t">
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase text-muted-foreground">Promotion status</span>
                <Badge variant={card.promotionStatus === "PROMOTED" ? "success" : card.promotionStatus === "REPEATED" ? "destructive" : "secondary"}>
                  {card.promotionStatus}
                </Badge>
                <span className="text-[10px] text-muted-foreground">School stamp</span>
                <span className="inline-block h-10 w-16 rounded border border-dashed border-muted-foreground/40" />
              </div>
              <div className="text-right">
                <div className="inline-flex flex-col items-center gap-1">
                  <svg viewBox="0 0 40 40" className="h-10 w-10 text-muted-foreground/60">
                    <rect x="2" y="2" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" />
                    <rect x="8" y="8" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M14 22 20 12l6 10M14 26h12" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  </svg>
                  <button onClick={verifyCode} className="text-[9px] font-mono text-primary underline print:hidden">
                    {card.verificationCode.slice(0, 8)}… verify
                  </button>
                  <span className="text-[9px] font-mono text-muted-foreground hidden print:inline">{card.verificationCode}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
