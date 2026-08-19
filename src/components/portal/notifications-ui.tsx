"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatRelativeTime } from "@/lib/utils";
import { NotificationIcon, type NotificationItem } from "@/components/portal/notification-drawer";

const PAGE_SIZE = 20;

export function NotificationsUI() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const offset = reset ? 0 : items.length;
      const res = await fetch(`/api/notifications?limit=${PAGE_SIZE}&offset=${offset}${tab === "unread" ? "&unreadOnly=1" : ""}`);
      const data = await parseJsonBody(res);
      if (res.ok && data?.notifications) {
        setItems((prev) => (reset ? data.notifications : [...prev, ...data.notifications]));
        setUnread(data.unread ?? 0);
        setTotal(data.total ?? 0);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tab, items.length]);

  useEffect(() => {
    setItems([]);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      /* ignore */
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setUnread(0);
        setItems((prev) => prev.map((i) => ({ ...i, read: true })));
      }
    } catch {
      /* ignore */
    }
  };

  const shown = tab === "unread" ? items.filter((i) => !i.read) : items;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Notification Center
          </h2>
          <p className="text-muted-foreground">All your school activity in one place</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={unread === 0}>
          <CheckCheck className="mr-1 h-4 w-4" /> Mark all read ({unread})
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({total})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unread})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-semibold">No notifications</h3>
            <p className="text-muted-foreground text-sm">New school activity will appear here.</p>
          </div>
        ) : (
          shown.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && markRead(n.id)}
              className={cn(
                "flex gap-4 rounded-xl border bg-card p-4 cursor-pointer transition-colors hover:bg-accent/40",
                !n.read && "border-primary/30 bg-primary/5"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                )}
              >
                <NotificationIcon type={n.type} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{n.title}</p>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatRelativeTime(n.createdAt)}</span>
                  {n.link && (
                    <Link href={n.link} className="text-primary hover:underline font-medium">
                      View →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && shown.length < total && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => load(false)} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
