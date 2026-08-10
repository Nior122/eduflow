"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  X,
  Plus,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Trash2,
  History,
  Search,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { consumeSse, type SseEvent } from "@/components/ai/sse";
import { MarkdownText } from "@/components/ai/markdown";
import { toast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };
type ConvMeta = { id: string; title: string; updatedAt: string };

/**
 * EduFlow AI — app-wide Assistant widget (Module 1).
 * Floating chat with tool-calling against the real database, conversation
 * history, copy / regenerate / feedback. Mounted once in DashboardLayout.
 */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [toolNote, setToolNote] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConvMeta[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/ai/conversations");
      const data = await res.json();
      if (res.ok) setConversations(data.conversations ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (open && conversations.length === 0) loadConversations();
  }, [open, conversations.length, loadConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming, toolNote]);

  const newChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setShowHistory(false);
    setToolNote(null);
    setFeedback(null);
  };

  const openConversation = async (id: string) => {
    setShowHistory(false);
    try {
      const res = await fetch(`/api/ai/conversations/${id}`);
      const data = await res.json();
      if (!res.ok || !data?.conversation) return;
      setConversationId(data.conversation.id);
      setMessages((data.conversation.messages as Msg[]).filter((m) => m.role === "user" || m.role === "assistant"));
    } catch {
      /* ignore */
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) newChat();
    } catch {
      /* ignore */
    }
  };

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || streaming) return;
    setInput("");
    setFeedback(null);
    const history: Msg[] = [...messages, { role: "user", content: message }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);
    setToolNote(null);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await consumeSse(
        "/api/ai/chat",
        { message, conversationId },
        (ev: SseEvent) => {
          if (ev.type === "text") {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content + ev.delta };
              return next;
            });
            setToolNote(null);
          } else if (ev.type === "tool_call") {
            setToolNote(ev.tool.name.replace(/_/g, " "));
          } else if (ev.type === "done") {
            if (ev.conversationId) setConversationId(ev.conversationId);
            loadConversations();
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content || `⚠️ ${(err as Error).message ?? "Something went wrong."}` };
          return next;
        });
      }
    } finally {
      setStreaming(false);
      setToolNote(null);
      abortRef.current = null;
    }
  };

  const regenerate = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || streaming) return;
    setMessages((prev) => prev.slice(0, -1));
    setStreaming(true);
    setToolNote(null);
    try {
      await send(lastUser.content);
    } finally {
      // send() already manages streaming state; guard against double set
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
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl hover:bg-primary/90 transition-transform hover:scale-105"
        title="EduFlow AI Assistant"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-7 w-7" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[560px] w-[calc(100vw-2.5rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2 border-b bg-primary px-4 py-3 text-primary-foreground">
            <Bot className="h-5 w-5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">EduFlow AI Assistant</p>
              <p className="text-[11px] opacity-80">Answers from your school's real data</p>
            </div>
            <button onClick={() => setShowHistory(!showHistory)} className="rounded-lg p-1.5 hover:bg-primary-foreground/15" title="Conversations">
              <History className="h-4 w-4" />
            </button>
            <button onClick={newChat} className="rounded-lg p-1.5 hover:bg-primary-foreground/15" title="New chat">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* History panel */}
          {showHistory ? (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                <Search className="h-3 w-3" /> Recent conversations
              </div>
              {loadingHistory ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)
              ) : conversations.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">No conversations yet</p>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => openConversation(c.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent",
                      c.id === conversationId && "bg-accent"
                    )}
                  >
                    <span className="flex-1 truncate">{c.title}</span>
                    <button onClick={(e) => deleteConversation(c.id, e)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-3">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                    <Bot className="h-10 w-10 text-primary/40" />
                    <p className="text-sm font-medium">Ask me anything about your school</p>
                    <p className="text-xs text-muted-foreground">
                      “Show students with poor attendance” · “How many students owe fees?” · “Find students failing Mathematics” · “Show today's timetable”
                    </p>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[88%] rounded-2xl px-3.5 py-2.5",
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
                {toolNote && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Querying the database: {toolNote}
                  </div>
                )}
              </div>

              {/* Actions on last answer */}
              {messages.length > 0 && !streaming && (
                <div className="flex items-center gap-1 px-3 pb-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copyLast}>
                    {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={regenerate}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Regenerate
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 px-2 text-xs", feedback === "up" && "text-emerald-500")}
                    onClick={() => setFeedback(feedback === "up" ? null : "up")}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 px-2 text-xs", feedback === "down" && "text-destructive")}
                    onClick={() => setFeedback(feedback === "down" ? null : "down")}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Input */}
              <div className="border-t p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    rows={2}
                    placeholder="Ask about students, fees, results, timetable…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <Button variant="gradient" size="icon" onClick={() => send()} disabled={streaming || !input.trim()} className="h-10 w-10 shrink-0">
                    {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  AI can make mistakes — verify important numbers in the relevant module.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
