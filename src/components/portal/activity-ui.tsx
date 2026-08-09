"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  LogIn,
  MessageSquare,
  Megaphone,
  FileUp,
  UserRound,
  KeyRound,
  Settings,
  Trash2,
  Loader2,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";

type LogItem = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const PAGE_SIZE = 20;

const ACTION_META: Record<string, { label: string; icon: React.ElementType }> = {
  LOGIN: { label: "Logged in", icon: LogIn },
  MESSAGE_SENT: { label: "Sent a message", icon: MessageSquare },
  MESSAGE_SAVED_DRAFT: { label: "Saved a message draft", icon: MessageSquare },
  ANNOUNCEMENT_CREATED: { label: "Published an announcement", icon: Megaphone },
  DOCUMENT_UPLOADED: { label: "Uploaded a document", icon: FileUp },
  DOCUMENT_UPDATED: { label: "Updated a document", icon: Upload },
  DOCUMENT_DELETED: { label: "Deleted a document", icon: Trash2 },
  UPLOAD_FILE: { label: "Uploaded a file", icon: Upload },
  PROFILE_UPDATED: { label: "Updated profile", icon: UserRound },
  PASSWORD_CHANGED: { label: "Changed password", icon: KeyRound },
  PREFERENCES_UPDATED: { label: "Updated preferences", icon: Settings },
  RESULT_PUBLISHED: { label: "Published results", icon: CheckCircle2 },
};

export function ActivityUI() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const offset = reset ? 0 : logs.length;
      const res = await fetch(`/api/activity?limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (res.ok && data?.logs) {
        setLogs((prev) => (reset ? data.logs : [...prev, ...data.logs]));
        setTotal(data.total ?? 0);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [logs.length]);

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" /> My Activity
        </h2>
        <p className="text-muted-foreground">Your recent actions across EduFlow</p>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Activity className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-semibold">No activity yet</h3>
          <p className="text-muted-foreground text-sm">Your actions will be recorded here.</p>
        </div>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-4">
            {logs.map((l) => {
              const meta = ACTION_META[l.action] ?? { label: l.action.replace(/_/g, " "), icon: Activity };
              const Icon = meta.icon;
              return (
                <div key={l.id} className="relative flex gap-4">
                  <span className="absolute -left-6 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-primary bg-background" />
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Card className="flex-1 px-4 py-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</p>
                    </div>
                    {l.metadata && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Object.entries(l.metadata)
                          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                          .join(" · ")}
                      </p>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && logs.length < total && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => load(false)} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Load more ({logs.length}/{total})
          </Button>
        </div>
      )}
    </div>
  );
}
