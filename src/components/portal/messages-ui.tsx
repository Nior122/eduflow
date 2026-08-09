"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mail,
  Send,
  Inbox,
  Search,
  PenSquare,
  Paperclip,
  Trash2,
  Loader2,
  X,
  FileText,
  CheckCheck,
  MessageSquare,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn, formatRelativeTime, getInitials } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Conversation = {
  key: string;
  lastId: string;
  other: { id: string; name: string; role: string } | null;
  subject: string;
  snippet: string;
  isDraft: boolean;
  unread: number;
  updatedAt: string;
};

type ThreadMessage = {
  id: string;
  subject: string;
  content: string;
  read: boolean;
  readAt: string | null;
  isDraft: boolean;
  replyToId: string | null;
  attachments: { name: string; url: string; size: number }[];
  createdAt: string;
  sender: { id: string; name: string; role: string };
  receiver: { id: string; name: string; role: string };
};

type Recipient = { id: string; name: string; role: string; label: string };
type Attachment = { name: string; url: string; size: number; mime?: string | null };

const ROLE_LABELS: Record<string, string> = {
  TEACHER: "Teacher",
  PARENT: "Parent",
  STUDENT: "Student",
  SCHOOL_ADMIN: "Admin",
  SUPER_ADMIN: "Admin",
  FINANCE_OFFICER: "Finance",
};

export function MessagesUI() {
  const [folder, setFolder] = useState("inbox");
  const [q, setQ] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Conversation | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/messages?folder=${folder}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok && data?.conversations) setConversations(data.conversations);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [folder, q]);

  useEffect(() => {
    setSelected(null);
    loadConversations();
  }, [loadConversations]);

  const openThread = async (conv: Conversation) => {
    setSelected(conv);
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/messages/${conv.lastId}`);
      const data = await res.json();
      if (res.ok && data?.messages) {
        setThread(data.messages);
        setConversations((prev) =>
          prev.map((c) => (c.key === conv.key ? { ...c, unread: 0 } : c))
        );
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [thread]);

  const sendReply = async () => {
    if (!selected?.other || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const last = thread[thread.length - 1];
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selected.other.id,
          subject: last.subject.startsWith("Re: ") ? last.subject : `Re: ${last.subject}`,
          content: replyText.trim(),
          replyToId: last.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setReplyText("");
      toast({ title: "Reply sent", variant: "success" });
      await openThread(selected);
      loadConversations();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to send", variant: "destructive" });
    } finally {
      setSendingReply(false);
    }
  };

  const deleteConversation = async () => {
    if (!selected) return;
    try {
      await fetch(`/api/messages/${selected.lastId}`, { method: "DELETE" });
      toast({ title: "Conversation deleted" });
      setSelected(null);
      loadConversations();
    } catch {
      /* ignore */
    }
  };

  const searchRecipients = async (query: string) => {
    setRecipientQuery(query);
    try {
      const res = await fetch(`/api/messages/recipients?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok) setRecipients(data.recipients ?? []);
    } catch {
      /* ignore */
    }
  };

  const openCompose = (draft?: Conversation) => {
    setEditingDraft(draft ?? null);
    setRecipient(null);
    setSubject(draft?.subject ?? "");
    setContent(draft?.snippet ?? "");
    setAttachments([]);
    setRecipientQuery("");
    setComposeOpen(true);
    if (draft?.other) {
      setRecipient({ id: draft.other.id, name: draft.other.name, role: draft.other.role, label: ROLE_LABELS[draft.other.role] ?? draft.other.role });
    } else {
      searchRecipients("");
    }
  };

  const uploadAttachment = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "messages");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const up = data.upload as Attachment;
      setAttachments((prev) => [...prev, { name: up.name, url: up.url, size: up.size, mime: up.mime }]);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const submitMessage = async (asDraft: boolean) => {
    if (!asDraft && !recipient) return toast({ title: "Choose a recipient", variant: "destructive" });
    if (!subject.trim()) return toast({ title: "Subject is required", variant: "destructive" });
    if (!content.trim()) return toast({ title: "Write a message", variant: "destructive" });
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: recipient?.id ?? undefined,
          subject: subject.trim(),
          content: content.trim(),
          attachments,
          isDraft: asDraft,
          draftId: editingDraft ? editingDraft.lastId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: asDraft ? "Draft saved" : "Message sent", variant: "success" });
      setComposeOpen(false);
      setFolder(asDraft ? "drafts" : "sent");
      loadConversations();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const formatSize = (bytes: number) =>
    bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Messages
          </h2>
          <p className="text-muted-foreground">Secure internal messaging between staff, parents and students</p>
        </div>
        <Button variant="gradient" onClick={() => openCompose()}>
          <PenSquare className="mr-1 h-4 w-4" /> New Message
        </Button>
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-4">
        {/* List pane */}
        <Card className="p-0 overflow-hidden">
          <div className="p-3 space-y-2 border-b">
            <Tabs value={folder} onValueChange={setFolder} className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="inbox"><Inbox className="mr-1 h-3.5 w-3.5" /> Inbox</TabsTrigger>
                <TabsTrigger value="sent"><Send className="mr-1 h-3.5 w-3.5" /> Sent</TabsTrigger>
                <TabsTrigger value="drafts"><FileText className="mr-1 h-3.5 w-3.5" /> Drafts</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 m-2" />)
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No {folder === "drafts" ? "drafts" : folder === "sent" ? "sent messages" : "messages"} yet</p>
              </div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.key}
                  onClick={() => (c.isDraft ? openCompose(c) : openThread(c))}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-3 border-b text-left hover:bg-accent/50 transition-colors",
                    selected?.key === c.key && "bg-accent"
                  )}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(c.other?.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {c.other?.name ?? "—"}
                        {c.other && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{ROLE_LABELS[c.other.role] ?? c.other.role}</span>}
                      </p>
                      <span className="text-[11px] text-muted-foreground shrink-0">{formatRelativeTime(c.updatedAt)}</span>
                    </div>
                    <p className="text-sm truncate">
                      {c.isDraft ? <span className="text-amber-500 font-medium">Draft: </span> : null}
                      <span className="font-medium">{c.subject}</span>
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground truncate">{c.snippet}</p>
                      {c.unread > 0 && (
                        <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Thread pane */}
        <Card className="p-0 overflow-hidden min-h-[480px] flex flex-col">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <h3 className="text-lg font-semibold">Select a conversation</h3>
              <p className="text-sm text-muted-foreground">Or start a new message to a teacher, parent or student.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b p-4">
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSelected(null)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">{getInitials(selected.other?.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selected.other?.name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground truncate">{selected.subject}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={deleteConversation}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                {loadingThread ? (
                  <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-20" />)}</div>
                ) : (
                  thread.map((m) => {
                    const isMine = m.sender.id !== selected.other?.id;
                    return (
                      <div key={m.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2.5",
                          isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border rounded-bl-sm"
                        )}>
                          <p className="text-xs opacity-70 mb-1">
                            {isMine ? "You" : m.sender.name} · {formatRelativeTime(m.createdAt)}
                          </p>
                          <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                          {m.attachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {m.attachments.map((a) => (
                                <a
                                  key={a.url}
                                  href={a.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cn(
                                    "flex items-center gap-1.5 text-xs underline-offset-2 hover:underline",
                                    isMine ? "text-primary-foreground/90" : "text-primary"
                                  )}
                                >
                                  <Paperclip className="h-3 w-3" /> {a.name}
                                </a>
                              ))}
                            </div>
                          )}
                          {isMine && m.read && (
                            <p className="mt-1 text-[10px] flex items-center gap-0.5 opacity-60">
                              <CheckCheck className="h-3 w-3" /> Read
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t p-3">
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    placeholder={`Reply to ${selected.other?.name ?? "…"}…`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                  <Button variant="gradient" onClick={sendReply} disabled={sendingReply || !replyText.trim()} className="self-end">
                    {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Compose dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingDraft ? "Edit Draft" : "New Message"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {!editingDraft && (
              <div className="space-y-1.5">
                <Label>To</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search teachers, parents, students…"
                    value={recipientQuery}
                    onChange={(e) => searchRecipients(e.target.value)}
                    className="pl-8"
                  />
                </div>
                {!recipient && recipients.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border divide-y">
                    {recipients.slice(0, 12).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setRecipient(r); setRecipientQuery(r.name); }}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
                      >
                        <span className="font-medium">{r.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{r.label}</Badge>
                      </button>
                    ))}
                  </div>
                )}
                {recipient && (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <span className="text-sm font-medium flex-1">{recipient.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{recipient.label}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setRecipient(null); setRecipientQuery(""); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your message…" />
            </div>
            <div className="space-y-1.5">
              <Label>Attachments</Label>
              <div className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <span key={a.url} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs">
                    <Paperclip className="h-3 w-3" /> {a.name} ({formatSize(a.size)})
                    <button onClick={() => setAttachments((prev) => prev.filter((x) => x.url !== a.url))}>
                      <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </span>
                ))}
                <label className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-dashed px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                  Add file
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAttachment(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => submitMessage(true)} disabled={sending}>
              Save Draft
            </Button>
            <Button
              variant="gradient"
              onClick={() => submitMessage(false)}
              disabled={sending || (!recipient && !editingDraft)}
            >
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {editingDraft ? "Send Draft" : "Send Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
