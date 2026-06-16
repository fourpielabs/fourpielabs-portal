"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Lock, Eye, Send } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  postMessageAction,
  getThreadMessagesAction,
  markThreadViewedAction,
  type ThreadMessage,
} from "@/lib/actions/messages";

export function Conversation({
  threadId,
  notifLink,
  currentUserId,
  currentUserName,
  initialMessages,
  audience,
}: {
  threadId: string;
  notifLink: string;
  currentUserId: string;
  currentUserName: string;
  initialMessages: ThreadMessage[];
  audience: "shared" | "internal";
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const refetch = () =>
    getThreadMessagesAction(threadId).then(setMessages).catch(() => {});

  // mark viewed on open → clears the bell's message notifications for THIS thread
  useEffect(() => {
    startTransition(() => {
      void markThreadViewedAction(threadId, notifLink);
    });
  }, [threadId, notifLink, startTransition]);

  // Realtime: postgres_changes INSERT (RLS-enforced) → refetch via the RLS-scoped
  // action (never render the raw payload — the third boundary layer).
  useEffect(() => {
    const supabase = createClient();
    // unique channel name per mount (avoids StrictMode / multi-instance name collision)
    const name = `thread-${threadId}-${Math.random().toString(36).slice(2)}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(name)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
          () => {
            refetch();
            void markThreadViewedAction(threadId, notifLink);
          },
        )
        .subscribe();
    });
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    // optimistic append — only ever YOUR OWN message
    const tmp: ThreadMessage = {
      id: `tmp-${Date.now()}`,
      body: text,
      authorId: currentUserId,
      authorName: currentUserName,
      authorRole: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((xs) => [...xs, tmp]);
    setBody("");
    const res = await postMessageAction(threadId, text);
    setSending(false);
    if (!res.ok) {
      setMessages((xs) => xs.filter((m) => m.id !== tmp.id));
      setBody(text);
      return toast.error("Message not sent", { description: res.error });
    }
    refetch();
  }

  const internal = audience === "internal";
  const banner = internal
    ? { cls: "border-amber-300 bg-amber-50 text-amber-900", icon: <Lock className="size-3.5" />, label: "Internal — the client cannot see this" }
    : { cls: "border-emerald-300 bg-emerald-50 text-emerald-900", icon: <Eye className="size-3.5" />, label: "Visible to the client" };

  return (
    <div className="flex h-[70vh] min-h-[440px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-e1">
      {/* message list */}
      <div className={cn("flex-1 space-y-3 overflow-y-auto p-4", internal && "bg-amber-50/30")}>
        {messages.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-ink-3">
            No messages yet — say hello.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.authorId === currentUserId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl border px-3.5 py-2",
                    mine ? "border-amber-200 bg-amber-100/70" : "border-border bg-surface",
                  )}
                >
                  <div className="mb-0.5 flex items-center gap-2 text-[11px] text-ink-3">
                    <span className="font-semibold text-ink-2">{mine ? "You" : m.authorName}</span>
                    {!mine && m.authorRole === "client" && (
                      <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-ink-2 uppercase">
                        Client
                      </span>
                    )}
                    <span className="tabular-nums">{formatRelative(m.createdAt)}</span>
                  </div>
                  <Markdown className="text-[14px]">{m.body}</Markdown>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* composer — the who-can-see-this indicator is unmissable for BOTH audiences */}
      <div className="border-t border-border p-3">
        <div className={cn("mb-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", banner.cls)}>
          {banner.icon} {banner.label}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="Write a message… (markdown supported · ⌘↵ to send)"
            className="resize-none"
          />
          <Button onClick={() => void send()} loading={sending} disabled={!body.trim()}>
            <Send className="size-4" /> {internal ? "Post internal" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
