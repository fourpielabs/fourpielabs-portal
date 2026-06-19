"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverSurface,
  CounterBadge,
  tokens,
} from "@fluentui/react-components";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  type NotificationItem,
} from "@/lib/actions/notifications";

/**
 * R1 ember-glass notification bell. The WIRING is preserved verbatim from
 * components/shell/notification-bell.tsx (same server actions + Supabase realtime +
 * unique channel per mount + optimistic read); only the rendering moves to a Fluent
 * Popover surface (themed by the surrounding FluentScope, so it's dark in dark mode).
 */
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

  // 4c Realtime: own-notification INSERT (RLS → caller's rows only) → live refetch.
  useEffect(() => {
    const supabase = createClient();
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
  }, []);

  function onItem(n: NotificationItem) {
    if (n.read_at) return;
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read_at: "now" } : x)));
    setUnread((u) => Math.max(0, u - 1));
    startTransition(() => void markNotificationReadAction(n.id));
  }
  function onMarkAll() {
    setItems((xs) => xs.map((x) => ({ ...x, read_at: x.read_at ?? "now" })));
    setUnread(0);
    startTransition(() => void markAllNotificationsReadAction());
  }

  const dark = tone === "dark";

  return (
    <Popover positioning="below-end" onOpenChange={(_, d) => d.open && void refresh()} withArrow>
      <PopoverTrigger disableButtonEnhancement>
        <button
          type="button"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
          className={cn(
            "rd-focus relative inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
            dark
              ? "text-[#cdc6ba] hover:bg-white/[0.08] hover:text-[#f3efe7]"
              : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          <Bell className="size-[18px]" strokeWidth={1.8} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5">
              {/* force white count text: our Warm Obsidian theme overrides
                  colorNeutralForegroundOnBrand to charcoal (for amber buttons),
                  which on the red danger badge would be charcoal-on-red (~3.7:1).
                  White on Fluent danger-red is ~4.9:1 (AA). */}
              <CounterBadge count={unread} color="danger" size="small" overflowCount={9} style={{ color: "#ffffff" }} />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverSurface style={{ padding: 0, width: 320 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colorNeutralForeground1 }}>
            Notifications
          </span>
          {unread > 0 && (
            <button
              type="button"
              onClick={onMarkAll}
              className="rd-focus"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: tokens.colorBrandForeground1,
              }}
            >
              Mark all read
            </button>
          )}
        </div>
        <div
          style={{
            maxHeight: "22rem",
            overflowY: "auto",
            borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
          }}
        >
          {items.length === 0 ? (
            <p style={{ padding: "2rem 0.75rem", textAlign: "center", fontSize: 14, color: tokens.colorNeutralForeground3 }}>
              You&apos;re all caught up.
            </p>
          ) : (
            items.map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "#"}
                onClick={() => onItem(n)}
                className="rd-focus"
                style={{
                  display: "block",
                  padding: "10px 12px",
                  textDecoration: "none",
                  borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
                  background: n.read_at ? "transparent" : "rgba(217,119,6,0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  {!n.read_at && (
                    <span style={{ marginTop: 6, width: 6, height: 6, flexShrink: 0, borderRadius: 999, background: "#d97706" }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 600, color: tokens.colorNeutralForeground1 }}>
                        {n.title}
                      </span>
                      <span style={{ flexShrink: 0, fontSize: 11, color: tokens.colorNeutralForeground3 }}>
                        {formatRelative(n.created_at)}
                      </span>
                    </div>
                    {n.body && (
                      <p style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: tokens.colorNeutralForeground3 }}>
                        {n.body}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </PopoverSurface>
    </Popover>
  );
}
