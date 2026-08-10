"use client";

import { useRef, useState } from "react";
import { Send, Loader2, Bot, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { consumeSse, type SseEvent } from "@/components/ai/sse";
import { MarkdownText } from "@/components/ai/markdown";

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Reusable streaming chat panel (homework assistant & friends).
 * Consumes an SSE endpoint and renders markdown answers.
 */
export function ChatPanel({
  endpoint,
  placeholder,
  subjectTopicLabel = "General",
}: {
  endpoint: string;
  placeholder: string;
  subjectTopicLabel?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [topic, setTopic] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || streaming) return;
    setInput("");
    const history: Msg[] = [...messages, { role: "user", content: message }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      await consumeSse(
        endpoint,
        { question: message, subjectTopic: topic.trim() || undefined },
        (ev: SseEvent) => {
          if (ev.type === "text") {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content + ev.delta };
              return next;
            });
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        }
      );
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: next[next.length - 1].content || `⚠️ ${(err as Error).message ?? "Something went wrong."}`,
        };
        return next;
      });
    } finally {
      setStreaming(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
    }
  };

  const copyLast = async () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant" && m.content);
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">Subject / topic (optional)</p>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Mathematics — Algebra"
          />
        </div>
        <div className="h-10" />
      </div>

      <Card className="overflow-hidden">
        <div ref={scrollRef} className="flex h-[480px] flex-col gap-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
              <Bot className="h-12 w-12 text-primary/40" />
              <p className="font-semibold">Ask anything about {subjectTopicLabel}</p>
              <p className="text-sm text-muted-foreground">
                I'll explain concepts, solve examples step-by-step and give you hints — without spoiling the answer.
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5",
                    m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"
                  )}
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                  ) : m.content ? (
                    <MarkdownText text={m.content} />
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t p-3">
          {messages.length > 0 && !streaming && (
            <div className="mb-2 flex justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={copyLast}>
                {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                {copied ? "Copied" : "Copy answer"}
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              rows={2}
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button variant="gradient" size="icon" className="h-10 w-10 shrink-0" onClick={() => send()} disabled={streaming || !input.trim()}>
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
