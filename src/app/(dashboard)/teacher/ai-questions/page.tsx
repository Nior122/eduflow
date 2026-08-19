"use client";

import { useCallback, useEffect, useState } from "react";
import { FileQuestion, Loader2, Wand2, Trash2, Download, Printer, Copy, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

type GeneratedQuestion = {
  type: string;
  difficulty: string;
  question: string;
  options?: Record<string, string> | null;
  answer: string;
  explanation?: string | null;
  marks: number;
};

type BankedQuestion = GeneratedQuestion & {
  id: string;
  topic: string;
  subject: string | null;
  className: string | null;
  createdAt: string;
};

const TYPES = [
  { value: "MCQ", label: "Multiple Choice" },
  { value: "THEORY", label: "Theory" },
  { value: "TRUE_FALSE", label: "True/False" },
  { value: "FILL_BLANK", label: "Fill in the Blank" },
  { value: "MATCHING", label: "Matching" },
  { value: "PRACTICAL", label: "Practical" },
];

export default function TeacherAiQuestionsPage() {
  const [subject, setSubject] = useState("");
  const [className, setClassName] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [count, setCount] = useState("8");
  const [types, setTypes] = useState<string[]>(["MCQ", "THEORY"]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedQuestion[]>([]);
  const [bank, setBank] = useState<BankedQuestion[]>([]);
  const [loadingBank, setLoadingBank] = useState(true);
  const [bankQ, setBankQ] = useState("");
  const [copied, setCopied] = useState(false);

  const loadBank = useCallback(async () => {
    setLoadingBank(true);
    try {
      const params = new URLSearchParams();
      if (bankQ.trim()) params.set("q", bankQ.trim());
      const res = await fetch(`/api/ai/questions?${params.toString()}`);
      const bodyText = await res.text();
      let data: any = null;
      try { data = bodyText ? JSON.parse(bodyText) : null; } catch { data = null; }
      if (res.ok) setBank(data?.questions ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoadingBank(false);
    }
  }, [bankQ]);

  useEffect(() => {
    loadBank();
  }, [loadBank]);

  const generate = async () => {
    if (!subject.trim() || !topic.trim()) {
      return toast({ title: "Subject and topic are required", variant: "destructive" });
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), className: className.trim() || undefined, topic: topic.trim(), difficulty, count: Number(count) || 8, types }),
      });
      const bodyText = await res.text();
      let data: any = null;
      try { data = bodyText ? JSON.parse(bodyText) : null; } catch { data = null; }
      if (!res.ok) throw new Error((data && typeof data.error === "string" && data.error) || `AI request failed (${res.status})`);
      setGenerated(data.questions ?? []);
      toast({ title: `${data.count ?? 0} questions generated & saved to the bank`, variant: "success" });
      loadBank();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Generation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const toggleType = (t: string) => {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const removeBanked = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/questions/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Question deleted" });
        loadBank();
      }
    } catch {
      /* ignore */
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(generated, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const downloadDoc = () => {
    const html = `<html><head><meta charset="utf-8"><title>${topic} — Questions</title></head><body>
<h1>${topic} — ${subject}</h1>
${generated.map((q, i) => `<p><b>${i + 1}. [${q.type}] (${q.marks} mark${q.marks > 1 ? "s" : ""})</b> ${q.question}</p>
${q.options ? `<p>${Object.entries(q.options).map(([k, v]) => `${k}. ${v}`).join("&nbsp;&nbsp;")}</p>` : ""}
<p><i>Answer: ${q.answer}</i></p>`).join("")}
</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.replace(/\s+/g, "-").toLowerCase()}-questions.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileQuestion className="h-6 w-6 text-primary" /> AI Question Generator
        </h2>
        <p className="text-muted-foreground">Generate exam-style questions and build your school's question bank</p>
      </div>

      {/* Generator form */}
      <Card>
        <CardHeader><CardTitle className="text-base">Generate questions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" />
            </div>
            <div className="space-y-1.5">
              <Label>Class (optional)</Label>
              <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="JSS 2A" />
            </div>
            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Quadratic Equations" />
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EASY">Easy</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HARD">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Question count</Label>
              <Input type="number" min={1} max={20} value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Question types</Label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => toggleType(t.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${types.includes(t.value) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Button variant="gradient" onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Generate questions
          </Button>
        </CardContent>
      </Card>

      {/* Generated */}
      {generated.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Generated ({generated.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyJson}>
                {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                {copied ? "Copied" : "Copy JSON"}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadDoc}>
                <Download className="mr-1 h-3 w-3" /> Word
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-1 h-3 w-3" /> Print / PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {generated.map((q, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{q.type.replace(/_/g, " ")}</Badge>
                  <Badge variant="secondary">{q.difficulty}</Badge>
                  <Badge variant="secondary">{q.marks} mark{q.marks > 1 ? "s" : ""}</Badge>
                </div>
                <p className="mt-2 font-medium">{i + 1}. {q.question}</p>
                {q.options && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {Object.entries(q.options).map(([k, v]) => `${k}. ${v}`).join("   ")}
                  </p>
                )}
                <p className="mt-1 text-sm text-emerald-600">Answer: {q.answer}</p>
                {q.explanation && <p className="mt-0.5 text-xs text-muted-foreground">{q.explanation}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Question bank */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Question bank ({bank.length})</CardTitle>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search bank…" value={bankQ} onChange={(e) => setBankQ(e.target.value)} className="pl-8 h-9" />
          </div>
        </CardHeader>
        <CardContent>
          {loadingBank ? (
            <Skeleton className="h-40" />
          ) : bank.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No questions saved yet — generate your first set above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bank.slice(0, 20).map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="max-w-md truncate font-medium">{q.question}</TableCell>
                    <TableCell className="text-xs">{q.topic}</TableCell>
                    <TableCell><Badge variant="secondary">{q.type.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-xs">{q.subject ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeBanked(q.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
