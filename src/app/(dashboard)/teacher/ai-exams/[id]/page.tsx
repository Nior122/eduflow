"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, Loader2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type ExamSection = {
  name: string;
  instructions?: string;
  questions: {
    type: string;
    question: string;
    options?: Record<string, string> | null;
    marks: number;
    answer: string;
  }[];
};

type Exam = {
  id: string;
  title: string;
  instructions: string | null;
  durationMins: number | null;
  sections: ExamSection[];
  markingScheme: { section: string; totalMarks: number; notes?: string }[];
  answerKey: { question: string; answer: string }[];
  difficultyCoverage: { difficulty: string; count: number }[];
  subject: string | null;
  className: string | null;
  createdAt: string;
};

export default function AiExamPrintPage() {
  const params = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/ai/exams/${params.id}`)
      .then((r) => r.json())
      .then((d) => setExam(d.exam ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-96" /></div>;
  }
  if (!exam) {
    return <p className="text-muted-foreground">Exam not found.</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in print:space-y-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" /> {exam.title}
          </h2>
          <p className="text-muted-foreground text-sm">{exam.subject ?? "—"} · {exam.className ?? "General"} · {exam.durationMins ? `${exam.durationMins} minutes` : ""}</p>
        </div>
        <Button variant="gradient" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      {/* Paper */}
      <div className="rounded-xl border bg-white p-8 text-black shadow-sm print:border-0 print:shadow-none">
        <div className="text-center border-b-2 border-black pb-4">
          <h1 className="text-xl font-bold">{exam.title}</h1>
          <p className="text-sm mt-1">{exam.subject ?? ""}{exam.className ? ` — ${exam.className}` : ""}</p>
          <p className="text-xs mt-1">Time allowed: {exam.durationMins ?? "—"} minutes</p>
        </div>

        {exam.instructions && (
          <div className="mt-4 text-sm">
            <p className="font-semibold">Instructions</p>
            <p className="whitespace-pre-wrap mt-1">{exam.instructions}</p>
          </div>
        )}

        <div className="mt-6 space-y-6">
          {exam.sections.map((sec, si) => (
            <div key={si}>
              <h3 className="font-bold border-b border-black pb-1">{sec.name}</h3>
              {sec.instructions && <p className="text-xs mt-1 italic">{sec.instructions}</p>}
              <div className="mt-3 space-y-3">
                {sec.questions.map((q, qi) => (
                  <div key={qi}>
                    <p className="text-sm">
                      {qi + 1}. {q.question} <span className="text-xs text-gray-500">({q.marks} mark{q.marks > 1 ? "s" : ""})</span>
                    </p>
                    {q.options && (
                      <p className="text-sm ml-4 mt-0.5">
                        {Object.entries(q.options).map(([k, v]) => `${k}. ${v}`).join("    ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-black pt-3 text-right text-sm">— End of Paper —</div>
      </div>

      {/* Answer key + marking scheme (print on separate page) */}
      <div className="rounded-xl border bg-white p-8 text-black shadow-sm print:break-before-page print:border-0 print:shadow-none">
        <h2 className="text-lg font-bold border-b-2 border-black pb-2">Answer Key</h2>
        <div className="mt-3 space-y-1.5">
          {exam.answerKey.length === 0 ? (
            exam.sections.flatMap((s) => s.questions).map((q, i) => (
              <p key={i} className="text-sm"><span className="font-medium">{i + 1}.</span> {q.answer}</p>
            ))
          ) : (
            exam.answerKey.map((a, i) => (
              <p key={i} className="text-sm"><span className="font-medium">{a.question}</span> — {a.answer}</p>
            ))
          )}
        </div>

        {exam.markingScheme.length > 0 && (
          <>
            <h2 className="text-lg font-bold border-b border-black pb-1 mt-6">Marking Scheme</h2>
            <div className="mt-2 space-y-1">
              {exam.markingScheme.map((m, i) => (
                <p key={i} className="text-sm">
                  <span className="font-medium">{m.section}</span> — {m.totalMarks} marks{m.notes ? ` (${m.notes})` : ""}
                </p>
              ))}
            </div>
          </>
        )}

        {exam.difficultyCoverage.length > 0 && (
          <div className="mt-4 flex gap-2">
            {exam.difficultyCoverage.map((d, i) => (
              <Badge key={i} variant="secondary">{d.difficulty}: {d.count}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
