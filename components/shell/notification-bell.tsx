"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  type NotificationItem,
} from "@/lib/actions/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NotificationBell({
  initialUnread = 0,
  initialItems = [],
  tone = "light",
}: {
  initialUnread?: number;
  initialItems?: NotificationItem[];
  tone?: "light" | "dark";
}) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [, startTransition] = useTransition();

  const refresh = () =>
    getNotificationsAction()
      .then((r) => {
        setUnread(r.unread);
        setItems(r.items);
      })
      .catch(() => {});

  // No per-navigation refetch: the badge stays live via the realtime subscription
  // below (new notifications) + the server-provided initial items; the list
  // reconciles when the user actually OPENS the bell (onOpenChange → refresh).

  // 4c Realtime: a new own-notification INSERT (RLS-enforced → only the caller's
  // own rows) → refetch live, so the bell updates without navigating.
  useEffect(() => {
    const supabase = createClient();
    // Unique channel name per subscription — the bell renders twice (sidebar +
    // mobile bar), and StrictMode double-mounts; a shared name collides ("cannot
    // add postgres_changes callbacks after subscribe()").
    const name = `bell-${Math.random().toString(36).slice(2)}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(name)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          () => void refresh(),
        )
        .subscribe();
    });
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onItem(n: NotificationItem) {
    if (n.read_at) return;
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read_at: "now" } : x)));
    setUnread((u) => Math.max(0, u - 1));
    startTransition(() => {
      void markNotificationReadAction(n.id);
    });
  }
  function onMarkAll() {
    setItems((xs) => xs.map((x) => ({ ...x, read_at: x.read_at ?? "now" })));
    setUnread(0);
    startTransition(() => {
      void markAllNotificationsReadAction();
    });
  }

  const btn =
    tone === "dark"
      ? "text-dark-ink-2 hover:bg-white/[0.06] hover:text-dark-ink"
      : "text-ink-2 hover:bg-surface-2 hover:text-ink";

  return (
    <DropdownMenu onOpenChange={(open) => open && void refresh()}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
          className={cn(
            "motion-micro relative inline-flex size-9 shrink-0 items-center justify-center rounded-full",
            btn,
          )}
        >
          <Bell className="size-[18px]" strokeWidth={1.8} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] leading-[15px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={onMarkAll}
              className="text-xs font-medium text-amber-700 hover:text-amber-800"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[22rem] overflow-y-auto border-t border-border">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-3">
              You&apos;re all caught up.
            </p>
          ) : (
            items.map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "#"}
                onClick={() => onItem(n)}
                className={cn(
                  "block border-b border-row-divider px-3 py-2.5 last:border-0 hover:bg-bg",
                  !n.read_at && "bg-amber-50/60",
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.read_at && (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-ink">
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-ink-3">
                        {formatRelative(n.created_at)}
                      </span>
                    </div>
                    {n.body && <p className="truncate text-xs text-ink-3">{n.body}</p>}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
