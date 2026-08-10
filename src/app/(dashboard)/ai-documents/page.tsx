"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Trash2, Upload, Sparkles, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { consumeSse, type SseEvent } from "@/components/ai/sse";
import { MarkdownText } from "@/components/ai/markdown";
import { formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type DocMeta = { id: string; title: string; sourceType: string; fileName: string | null; uploader: string | null; createdAt: string };

export default function AiDocumentsPage() {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [action, setAction] = useState<"summarize" | "ask">("summarize");
  const [question, setQuestion] = useState("");
  const [processing, setProcessing] = useState(false);
  const [answer, setAnswer] = useState("");
  const [streaming, setStreaming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/documents");
      const data = await res.json();
      if (res.ok) setDocs(data.documents ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const process = async () => {
    if (!file) return toast({ title: "Choose a file first", variant: "destructive" });
    if (action === "ask" && !question.trim()) return toast({ title: "Enter a question", variant: "destructive" });
    setProcessing(true);
    setStreaming(true);
    setAnswer("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title.trim());
      form.append("action", action);
      if (action === "ask") form.append("question", question.trim());
      const res = await fetch("/api/ai/document-assistant", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Upload failed");
      }
      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        await consumeSseFromResponse(res, (ev) => {
          if (ev.type === "text") setAnswer((prev) => prev + ev.delta);
          else if (ev.type === "error") throw new Error(ev.message);
        });
      } else {
        const data = await res.json();
        setAnswer(data.text ?? "");
      }
      toast({ title: action === "summarize" ? "Summary ready" : "Answer ready", variant: "success" });
      load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Processing failed", variant: "destructive" });
    } finally {
      setProcessing(false);
      setStreaming(false);
    }
  };

  const consumeSseFromResponse = async (res: Response, onEvent: (ev: SseEvent) => void) => {
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          onEvent(JSON.parse(payload) as SseEvent);
        } catch {
          /* ignore */
        }
      }
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Document removed" });
        load();
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> AI Document Assistant
        </h2>
        <p className="text-muted-foreground">Upload PDF, Word, Excel or text — summarize it or ask questions about it</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Upload a document</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Document (max 10 MB)</Label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 hover:bg-accent/40 transition-colors">
                <Upload className="h-7 w-7 text-muted-foreground" />
                {file ? <p className="text-sm font-medium">{file.name}</p> : <p className="text-sm text-muted-foreground">Click to choose (pdf, docx, xlsx, txt, md, csv)</p>}
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title (optional)</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. School Handbook" />
              </div>
              <div className="space-y-1.5">
                <Label>Action</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={action === "summarize" ? "gradient" : "outline"} size="sm" onClick={() => setAction("summarize")}>
                    <Sparkles className="mr-1 h-3.5 w-3.5" /> Summarize
                  </Button>
                  <Button type="button" variant={action === "ask" ? "gradient" : "outline"} size="sm" onClick={() => setAction("ask")}>
                    <MessageCircleQuestion className="mr-1 h-3.5 w-3.5" /> Ask a question
                  </Button>
                </div>
              </div>
              {action === "ask" && (
                <div className="space-y-1.5">
                  <Label>Question</Label>
                  <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What are the school hours?" />
                </div>
              )}
            </div>
          </div>
          <Button variant="gradient" onClick={process} disabled={processing || !file}>
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {action === "summarize" ? "Summarize document" : "Answer question"}
          </Button>
        </CardContent>
      </Card>

      {streaming && (
        <Card>
          <CardContent className="p-5 space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> {action === "summarize" ? "Summarizing…" : "Answering…"}
            </p>
            {answer && <MarkdownText text={answer} />}
          </CardContent>
        </Card>
      )}
      {!streaming && answer && (
        <Card>
          <CardContent className="p-5">
            <MarkdownText text={answer} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Knowledge documents ({docs.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <Skeleton className="h-24" />
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No documents uploaded yet.</p>
          ) : (
            docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.sourceType} · {d.fileName ?? "pasted text"} · {d.uploader ?? "—"} · {formatDate(d.createdAt)}
                  </p>
                </div>
                <Badge variant="secondary">{d.sourceType}</Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(d.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
