"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CheckSquare, CornerDownRight, Eye, Lock, Paperclip, Pencil, Reply, Search, Smile, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/format";
import { useReducedMotion } from "@/lib/motion";
import { MessageAttachment } from "@/components/messaging/message-attachment";
import { REACTION_EMOJIS, QUICK_REACT } from "@/lib/emoji";
import type { TaskMember } from "@/lib/tasks";
import {
  postMessageAction, getThreadMessagesAction, markThreadViewedAction, getThreadParticipantsAction,
  editMessageAction, deleteMessageAction, searchThreadMessagesAction, createTaskFromChatAction,
  type ThreadMessage, type ThreadParticipant,
} from "@/lib/actions/messages";
import { getThreadReactionsAction, toggleReactionAction, type ReactionGroup } from "@/lib/actions/reactions";
import { setTypingAction, getActiveTypersAction, getThreadReadsAction, type Typer, type ReadReceipt } from "@/lib/actions/presence";
import { uploadMessageAttachmentAction } from "@/lib/actions/message-attachments";
import { Button, EmberButton, BaseModal, Popover, PopoverTrigger, PopoverSurface, tokens } from "@/components/redesign/ui";
import { RichMessage } from "@/components/redesign/messaging/rich-message";
import type { RichComposerApi } from "@/components/redesign/messaging/rich-composer";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";

export type ConversationTaskContext = { role: "client" | "staff"; clientId: string; members: TaskMember[] };

// TipTap is heavy → code-split: the editor chunk loads only when a Conversation mounts,
// never in the entry/shell bundle. A light placeholder avoids layout shift while it loads.
const RichComposer = dynamic(
  () => import("@/components/redesign/messaging/rich-composer").then((m) => m.RichComposer),
  { ssr: false, loading: () => <div style={{ minHeight: 96, borderRadius: 10, opacity: 0.5 }} aria-hidden /> },
);

/**
 * R2 client Conversation (Warm Obsidian, mode-aware). Track-5 S1: the markdown textarea is
 * replaced by a TipTap WYSIWYG composer (code-split). Content coexistence: NEW messages
 * store TipTap HTML in body_rich (rendered sanitized); OLD messages have body_rich=null and
 * render their legacy markdown body via <Markdown> — no history re-encoding. The boundary is
 * unchanged: the page only ever passes the client_shared thread, post/edit/delete go through
 * the RLS+author-gated RPCs, realtime triggers an RLS-scoped refetch (never the raw payload),
 * and create-task-from-chat posts to the current thread only (never internal).
 */
export function Conversation({
  threadId, notifLink, currentUserId, currentUserName, initialMessages, audience, taskContext, bare = false,
}: {
  threadId: string; notifLink: string; currentUserId: string; currentUserName: string;
  initialMessages: ThreadMessage[]; audience: "shared" | "internal"; taskContext?: ConversationTaskContext; bare?: boolean;
}) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const router = useRouter();
  // S5: deep-link chips render as spans with data-href (set ONLY by the server resolver, from an
  // internal route). Delegate clicks/Enter to navigate — guard to internal paths defensively.
  const onEntityActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    const el = (e.target as HTMLElement).closest?.(".rd-entity[data-href]") as HTMLElement | null;
    if (!el) return;
    const href = el.getAttribute("data-href");
    if (!href || !href.startsWith("/")) return;
    e.preventDefault();
    router.push(href);
  };
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [participants, setParticipants] = useState<ThreadParticipant[]>([]);
  const reduced = useReducedMotion();
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const [reactions, setReactions] = useState<Record<string, ReactionGroup[]>>({});
  const [typers, setTypers] = useState<Typer[]>([]);
  const [reads, setReads] = useState<ReadReceipt[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ThreadMessage[] | null>(null);
  const composerApi = useRef<RichComposerApi | null>(null);

  const messagesRef = useRef(initialMessages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const removedRef = useRef<Set<string>>(new Set());

  // reconcile an optimistic temp against its real row by (body + parent) — keyed on the parent
  // too so identical-body messages in different reply threads can't cross-cancel.
  const tmpKey = (m: ThreadMessage) => `${m.body.trim()} ${m.parentMessageId ?? ""}`;
  const syncNew = async () => {
    const cur = messagesRef.current;
    const lastReal = [...cur].reverse().find((m) => !m.id.startsWith("tmp-"));
    const fresh = await getThreadMessagesAction(threadId, lastReal?.createdAt).catch(() => [] as ThreadMessage[]);
    if (!fresh.length) return;
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const add = fresh.filter((m) => !ids.has(m.id) && !removedRef.current.has(m.id));
      if (!add.length) return prev;
      // reconcile each incoming REAL row against its optimistic temp by (body + parent) — keying
      // on the parent too so identical-body messages in different reply threads can't cross-cancel.
      const mineKeys = new Set(add.filter((m) => m.authorId === currentUserId).map(tmpKey));
      const cleaned = mineKeys.size ? prev.filter((m) => !(m.id.startsWith("tmp-") && mineKeys.has(tmpKey(m)))) : prev;
      return [...cleaned, ...add];
    });
  };
  // Full reload (edits/deletes). PRESERVES in-flight optimistic temps not yet in the fresh rows,
  // so a concurrent event (e.g. another user's reaction bumping updated_at) can't wipe a message
  // you're mid-sending.
  const fullRefetch = () =>
    getThreadMessagesAction(threadId).then((fresh) => setMessages((prev) => {
      const real = fresh.filter((m) => !removedRef.current.has(m.id));
      const realKeys = new Set(real.filter((m) => m.authorId === currentUserId).map(tmpKey));
      const tmps = prev.filter((m) => m.id.startsWith("tmp-") && !realKeys.has(tmpKey(m)));
      return [...real, ...tmps];
    })).catch(() => {});
  // Reactions are fetched separately (RLS-scoped: a client gets ZERO rows for internal
  // messages) and refreshed wholesale on load + after a toggle + on realtime refetch. A
  // generation counter guards against a slow/in-flight refetch resolving LATE and clobbering
  // a newer optimistic toggle (the cold first-call vs. fast optimistic race).
  const reactionsGen = useRef(0);
  const refetchReactions = () => {
    const gen = ++reactionsGen.current;
    return getThreadReactionsAction(threadId).then((r) => { if (gen === reactionsGen.current) setReactions(r); }).catch(() => {});
  };

  // Toggle the viewer's reaction. Optimistic: flip the chip locally, then call the gated RPC
  // and reconcile via a refetch. The RPC bumps the message's updated_at → the existing
  // (RLS-safe) messages UPDATE realtime event drives every OTHER viewer's refetch.
  async function toggleReaction(messageId: string, emoji: string) {
    reactionsGen.current++; // invalidate any in-flight refetch — its result is now stale
    setReactions((prev) => {
      const groups = [...(prev[messageId] ?? [])];
      const i = groups.findIndex((g) => g.emoji === emoji);
      if (i === -1) groups.push({ emoji, count: 1, mine: true, names: ["You"] });
      else {
        const g = groups[i];
        if (g.mine) { const c = g.count - 1; if (c <= 0) groups.splice(i, 1); else groups[i] = { ...g, count: c, mine: false, names: g.names.filter((n) => n !== "You") }; }
        else groups[i] = { ...g, count: g.count + 1, mine: true, names: [...g.names, "You"] };
      }
      return { ...prev, [messageId]: groups };
    });
    const res = await toggleReactionAction(messageId, emoji);
    if (!res.ok) toast.error("Couldn't react", { description: res.error });
    void refetchReactions(); // reconcile with the authoritative, RLS-scoped state
  }

  // Typing + read receipts ride RLS-filtered postgres_changes (typing_states / thread_reads),
  // NOT presence/broadcast — so a client physically can't receive an internal-thread signal
  // (the SELECT policies mirror messages; the events are RLS-filtered; INSERT/UPDATE only).
  const refetchTypers = () => getActiveTypersAction(threadId).then(setTypers).catch(() => {});
  const refetchReads = () => getThreadReadsAction(threadId).then(setReads).catch(() => {});
  // Signal "typing" at most once per interval while the user edits (the RPC upserts; the row
  // expires by timestamp, so no stop-signal/DELETE is needed).
  const lastTypingSent = useRef(0);
  function onType() {
    const now = Date.now();
    if (now - lastTypingSent.current < 2500) return;
    lastTypingSent.current = now;
    void setTypingAction(threadId);
  }

  function startEdit(m: ThreadMessage) { setEditingId(m.id); setEditBody(m.body); }
  function cancelEdit() { setEditingId(null); setEditBody(""); }
  async function saveEdit(m: ThreadMessage) {
    const text = editBody.trim();
    if (!text) return;
    const prev = { body: m.body, bodyRich: m.bodyRich, edited: m.editedAt };
    // inline edit is plain-text → the edited message renders as plain (body_rich cleared).
    setMessages((xs) => xs.map((x) => (x.id === m.id ? { ...x, body: text, bodyRich: null, editedAt: new Date().toISOString() } : x)));
    setEditingId(null); setEditBody("");
    const res = await editMessageAction(m.id, text, null);
    if (!res.ok) { setMessages((xs) => xs.map((x) => (x.id === m.id ? { ...x, body: prev.body, bodyRich: prev.bodyRich, editedAt: prev.edited } : x))); toast.error("Couldn't edit", { description: res.error }); }
  }
  async function deleteMessage(m: ThreadMessage) {
    removedRef.current.add(m.id);
    const snapshot = messagesRef.current;
    setMessages((xs) => xs.filter((x) => x.id !== m.id));
    const res = await deleteMessageAction(m.id);
    if (!res.ok) { removedRef.current.delete(m.id); setMessages(snapshot); toast.error("Couldn't delete", { description: res.error }); }
  }

  useEffect(() => { getThreadParticipantsAction(threadId).then(setParticipants).catch(() => {}); }, [threadId]);
  useEffect(() => {
    lastTypingSent.current = 0; // reset the typing debounce if this component is reused across threads
    void refetchReactions();
    void refetchReads();
    void refetchTypers();
    // re-poll typers so stale "is typing…" clears even without a new event
    const iv = setInterval(() => void refetchTypers(), 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSearchResults(null); return; }
    const t = setTimeout(() => { searchThreadMessagesAction(threadId, q).then(setSearchResults).catch(() => setSearchResults(null)); }, 300);
    return () => clearTimeout(t);
  }, [search, threadId]);

  useEffect(() => { startTransition(() => { void markThreadViewedAction(threadId, notifLink); }); }, [threadId, notifLink, startTransition]);

  useEffect(() => {
    const supabase = createClient();
    const name = `thread-${threadId}-${Math.random().toString(36).slice(2)}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase.channel(name)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, () => { void syncNew(); void refetchReactions(); void markThreadViewedAction(threadId, notifLink); })
        // a reaction toggle bumps the message's updated_at → this RLS-safe UPDATE event drives
        // the live reaction refresh (a client never receives an internal message's UPDATE). A
        // bump-only event (no edit/delete) refetches reactions ONLY — not the whole thread — so a
        // busy thread doesn't full-reload per reaction (and can't wipe an in-flight optimistic send).
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, (payload) => {
          const n = payload.new as { id?: string; edited_at?: string | null; deleted_at?: string | null; body?: string } | null;
          const cur = n?.id ? messagesRef.current.find((m) => m.id === n.id) : undefined;
          const contentChanged = !cur || (n?.deleted_at != null) || (cur.editedAt ?? null) !== (n?.edited_at ?? null) || cur.body !== n?.body;
          if (contentChanged) void fullRefetch();
          void refetchReactions();
        })
        // typing + read receipts: INSERT/UPDATE only, RLS-filtered + scoped to this thread, so a
        // client NEVER receives an internal-thread typing/seen event. The payload is never
        // rendered — each event triggers an RLS-scoped refetch (the proven third boundary layer).
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "typing_states", filter: `thread_id=eq.${threadId}` }, () => void refetchTypers())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "typing_states", filter: `thread_id=eq.${threadId}` }, () => void refetchTypers())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "thread_reads", filter: `thread_id=eq.${threadId}` }, () => void refetchReads())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "thread_reads", filter: `thread_id=eq.${threadId}` }, () => void refetchReads())
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); }, [messages.length, reduced]);

  async function send(payload: { text: string; html: string; mentionIds: string[] }) {
    const text = payload.text.trim();
    if ((!text && !file) || sending) return;
    setSending(true);
    const parentId = replyingTo?.id ?? null; // S2: this send is a reply if a parent is targeted
    let attachmentPath: string | undefined, attachmentName: string | undefined;
    if (file) {
      const fd = new FormData(); fd.append("file", file);
      const up = await uploadMessageAttachmentAction(threadId, fd);
      if (!up.ok) { setSending(false); return toast.error("Attachment failed", { description: up.error }); }
      attachmentPath = up.path; attachmentName = up.name;
    }
    const tmp: ThreadMessage = { id: `tmp-${Date.now()}`, body: text, bodyRich: payload.html || null, authorId: currentUserId, authorName: currentUserName, authorRole: null, createdAt: new Date().toISOString(), attachmentName: attachmentName ?? null, editedAt: null, parentMessageId: parentId, linkedTask: null };
    setMessages((xs) => [...xs, tmp]); composerApi.current?.clear(); setFile(null); setReplyingTo(null);
    const res = await postMessageAction(threadId, text, payload.mentionIds, attachmentPath, attachmentName, payload.html || null, parentId);
    setSending(false);
    if (!res.ok) { setMessages((xs) => xs.filter((m) => m.id !== tmp.id)); composerApi.current?.setHTML(payload.html); return toast.error("Message not sent", { description: res.error }); }
    void syncNew();
  }

  function startReply(m: ThreadMessage) { setReplyingTo(m); composerApi.current?.focus(); }

  const taskBusyRef = useRef(false);
  async function createTaskFromChat(text: string) {
    const draft = text.trim();
    if (!draft || taskBusyRef.current) return; // synchronous re-entry guard (no double-create)
    taskBusyRef.current = true; setTaskBusy(true);
    try {
      const res = await createTaskFromChatAction(threadId, draft);
      if (!res.ok) return void toast.error("Couldn't create task", { description: res.error });
      composerApi.current?.clear();
      toast.success("Task created.");
      // The action returns the posted message + new task id, so attach the bubble directly —
      // no refetch race (the realtime INSERT for the same message id de-dupes in syncNew). If the
      // message already arrived via realtime, fold linkedTask onto it; otherwise append it.
      const d = res.data;
      if (d) {
        const linked = { id: d.taskId, title: d.title, status: d.status };
        setMessages((xs) =>
          xs.some((m) => m.id === d.messageId)
            ? xs.map((m) => (m.id === d.messageId ? { ...m, linkedTask: linked } : m))
            : [...xs, { id: d.messageId, body: draft, bodyRich: null, authorId: currentUserId, authorName: currentUserName, authorRole: null, createdAt: new Date().toISOString(), attachmentName: null, editedAt: null, parentMessageId: null, linkedTask: linked }],
        );
      }
    } finally {
      taskBusyRef.current = false; setTaskBusy(false);
    }
  }

  // ----- styling tokens (mode-aware) -----
  const fg1 = tokens.colorNeutralForeground1, fg2 = tokens.colorNeutralForeground2, fg3 = tokens.colorNeutralForeground3;
  const border = onDark ? "#34302a" : "#e7e5e0";
  const surface = onDark ? "#1c1813" : "#ffffff";
  const surface2 = onDark ? "#231f19" : "#f4f4f0";
  const mineBg = onDark ? "rgba(245,158,11,0.14)" : "#fef3c7";
  const mineBorder = onDark ? "rgba(245,158,11,0.3)" : "#fde68a";
  const internal = audience === "internal";
  const isClient = taskContext?.role === "client";
  const banner = internal
    ? { bg: onDark ? "rgba(245,158,11,0.12)" : "#fffaf0", bd: onDark ? "rgba(245,158,11,0.3)" : "#fde68a", fg: onDark ? "#fcd34d" : "#92400e", icon: <Lock size={13} />, label: "Internal — the client cannot see this" }
    : { bg: onDark ? "rgba(34,197,94,0.12)" : "#ecfdf5", bd: onDark ? "rgba(34,197,94,0.3)" : "#a7f3d0", fg: onDark ? "#86efac" : "#166534", icon: <Eye size={13} />, label: "Visible to the client" };

  const taskHref = (taskId: string) =>
    isClient ? `/tasks?task=${taskId}` : `/clients/${taskContext?.clientId}/tasks?task=${taskId}`;

  // S4 read receipts: the viewer's LAST own (non-temp) message, and who has read up to it. Only
  // reads RLS-scoped to this thread are in `reads`, so a client never sees internal seen-state.
  const lastOwnMsgId = useMemo(
    () => [...messages].reverse().find((m) => m.authorId === currentUserId && !m.id.startsWith("tmp-"))?.id ?? null,
    [messages, currentUserId],
  );
  const seenBy = useMemo(() => {
    const m = messages.find((x) => x.id === lastOwnMsgId);
    if (!m) return [] as ReadReceipt[];
    const at = new Date(m.createdAt).getTime();
    return reads.filter((r) => new Date(r.lastReadAt).getTime() >= at);
  }, [messages, lastOwnMsgId, reads]);

  // S2 threading: group replies under their top-level ROOT. A message is a root when it has
  // no parent OR its parent isn't in the visible set (a soft-deleted or not-yet-loaded parent
  // → the reply gracefully promotes to top-level rather than vanishing). Replies render
  // indented under their root, chronologically. `messages` is already created_at-ascending
  // (optimistic temps appended last), so iteration order stays chronological in each group.
  const { roots, repliesByRoot } = useMemo(() => {
    const byId = new Map(messages.map((m) => [m.id, m]));
    const rootOf = (m: ThreadMessage): string => {
      let cur = m, guard = 0;
      while (cur.parentMessageId && byId.has(cur.parentMessageId) && guard++ < 100) cur = byId.get(cur.parentMessageId)!;
      return cur.id;
    };
    const rootList: ThreadMessage[] = [];
    const byRoot = new Map<string, ThreadMessage[]>();
    for (const m of messages) {
      const rid = rootOf(m);
      if (rid === m.id) rootList.push(m);
      else { const arr = byRoot.get(rid) ?? []; arr.push(m); byRoot.set(rid, arr); }
    }
    return { roots: rootList, repliesByRoot: byRoot };
  }, [messages]);

  // One message row (bubble). Used for both top-level rows and indented replies. The Reply
  // affordance shows only on top-level, non-temp rows (Slack-style 2-level threading); edit/
  // delete stay gated to the author's own non-temp messages.
  const renderRow = (m: ThreadMessage, isReply: boolean) => {
    const mine = m.authorId === currentUserId;
    const isTmp = m.id.startsWith("tmp-");
    const reactBtn: React.CSSProperties = { display: "inline-flex", width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", background: "none", cursor: "pointer", color: fg3, fontSize: 12, lineHeight: 1 };
    return (
      <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
        <div className="rd-bubble" style={{ maxWidth: "78%", borderRadius: 16, padding: "8px 14px", border: `1px solid ${mine ? mineBorder : border}`, background: mine ? mineBg : surface }}>
          <div style={{ marginBottom: 2, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: fg3 }}>
            <span style={{ fontWeight: 600, color: fg2 }}>{mine ? "You" : m.authorName}</span>
            {!mine && m.authorRole === "client" && <span style={{ borderRadius: 999, background: surface2, padding: "1px 6px", fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: fg2 }}>Client</span>}
            <span className="rd-tnum">{formatRelative(m.createdAt)}</span>
            {m.editedAt && <span style={{ color: fg3 }}>· edited</span>}
            {!isReply && !isTmp && editingId !== m.id && (
              <button type="button" onClick={() => startReply(m)} aria-label="Reply to message" className="rd-focus" style={{ display: "inline-flex", width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", background: "none", cursor: "pointer", color: fg3 }}><Reply size={12} /></button>
            )}
            {mine && !isTmp && editingId !== m.id && (
              <>
                <button type="button" onClick={() => startEdit(m)} aria-label="Edit message" className="rd-focus" style={{ display: "inline-flex", width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", background: "none", cursor: "pointer", color: fg3 }}><Pencil size={12} /></button>
                <DeleteMessageButton color={fg3} onConfirm={() => deleteMessage(m)} />
              </>
            )}
            {/* hover/focus-revealed quick-react bar (always on for touch — see .rd-react-bar CSS) */}
            {!isTmp && editingId !== m.id && (
              <span className="rd-react-bar" style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                {QUICK_REACT.map((e) => (
                  <button key={e} type="button" onClick={() => void toggleReaction(m.id, e)} aria-label={`React ${e}`} className="rd-focus" style={reactBtn}>{e}</button>
                ))}
                <Popover positioning="above-end" withArrow>
                  <PopoverTrigger disableButtonEnhancement>
                    <button type="button" aria-label="Add reaction" className="rd-focus" style={reactBtn}><Smile size={12} /></button>
                  </PopoverTrigger>
                  <PopoverSurface style={{ padding: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 2 }}>
                      {REACTION_EMOJIS.map((e) => <button key={e} type="button" onClick={() => void toggleReaction(m.id, e)} aria-label={`React ${e}`} style={{ borderRadius: 6, border: "none", background: "none", cursor: "pointer", padding: 4, fontSize: 18, lineHeight: 1 }}>{e}</button>)}
                    </div>
                  </PopoverSurface>
                </Popover>
              </span>
            )}
          </div>
          {editingId === m.id ? (
            <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
              <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} autoFocus
                onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void saveEdit(m); } }}
                style={{ resize: "none", fontSize: 14, borderRadius: 8, border: `1px solid ${border}`, background: surface, color: fg1, padding: 8, outline: "none" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <EmberButton size="small" onClick={() => void saveEdit(m)} disabled={!editBody.trim()}>Save</EmberButton>
                <Button size="small" appearance="subtle" onClick={cancelEdit}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <RichMessage body={m.body} bodyRich={m.bodyRich} fg1={fg1} />
              {m.linkedTask && (
                <a href={taskHref(m.linkedTask.id)} className="rd-focus"
                  style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, borderRadius: 10, border: `1px solid ${onDark ? "rgba(245,158,11,0.35)" : "#fcd34d"}`, background: onDark ? "rgba(245,158,11,0.1)" : "#fffbeb", padding: "8px 10px", textDecoration: "none", color: fg1 }}>
                  <CheckSquare size={16} color={onDark ? "#fcd34d" : "#b45309"} style={{ flexShrink: 0 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: onDark ? "#fcd34d" : "#92400e" }}>Task</span>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.linkedTask.title}</span>
                  </span>
                </a>
              )}
              {m.attachmentName && (isTmp ? (
                <span style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, border: `1px solid ${border}`, background: surface2, padding: "6px 10px", fontSize: 12, fontWeight: 500, color: fg3 }}><Paperclip size={14} /> {m.attachmentName}</span>
              ) : (
                <MessageAttachment messageId={m.id} name={m.attachmentName} />
              ))}
              {(reactions[m.id]?.length ?? 0) > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {reactions[m.id].map((g) => (
                    <button key={g.emoji} type="button" onClick={() => void toggleReaction(m.id, g.emoji)} title={g.names.join(", ")}
                      aria-label={`${g.emoji} ${g.count}${g.mine ? ", including you — click to remove" : " — click to add yours"}`} aria-pressed={g.mine} className="rd-focus"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, padding: "1px 8px", cursor: "pointer", fontSize: 12,
                        border: `1px solid ${g.mine ? (onDark ? "rgba(245,158,11,0.55)" : "#fcd34d") : border}`,
                        background: g.mine ? (onDark ? "rgba(245,158,11,0.18)" : "#fef3c7") : surface2, color: fg1 }}>
                      <span style={{ fontSize: 13, lineHeight: 1.4 }}>{g.emoji}</span>
                      <span style={{ fontWeight: 600 }}>{g.count}</span>
                    </button>
                  ))}
                </div>
              )}
              {m.id === lastOwnMsgId && seenBy.length > 0 && (
                <div style={{ marginTop: 4, textAlign: "right", fontSize: 10.5, fontWeight: 500, color: fg3 }}>
                  <Eye size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                  Seen by {seenBy.map((s) => s.name).join(", ")} · <span className="rd-tnum">{formatRelative(seenBy.reduce((a, b) => (new Date(a.lastReadAt).getTime() > new Date(b.lastReadAt).getTime() ? a : b)).lastReadAt)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const inner = (
    <>
      <div className={onDark ? "rd-solid--dark" : "rd-solid"} style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 20, height: "72vh", minHeight: 460 }}>
        {/* search */}
        <div style={{ position: "relative", borderBottom: `1px solid ${border}`, padding: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, background: surface2, padding: "6px 10px" }}>
            <Search size={14} color={fg3} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search this conversation" placeholder="Search this conversation…"
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 13, color: fg1 }} />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="rd-focus" style={{ background: "none", border: "none", cursor: "pointer", color: fg3 }}><X size={14} /></button>}
          </div>
          {searchResults !== null && (
            <div style={{ position: "absolute", insetInline: 8, top: "100%", zIndex: 20, marginTop: 4, maxHeight: "18rem", overflowY: "auto", borderRadius: 12, border: `1px solid ${border}`, background: surface, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.3)" }}>
              {searchResults.length === 0 ? (
                <p style={{ padding: "1rem", textAlign: "center", fontSize: 12, color: fg3 }}>No matches in this conversation.</p>
              ) : searchResults.map((r) => (
                <div key={r.id} style={{ borderBottom: `1px solid ${surface2}`, padding: "8px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: fg3 }}>
                    <span style={{ fontWeight: 600, color: fg2 }}>{r.authorId === currentUserId ? "You" : r.authorName}</span>
                    <span className="rd-tnum">{formatRelative(r.createdAt)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: fg1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* message list */}
        <div onClick={onEntityActivate} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onEntityActivate(e); }}
          style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, background: internal ? (onDark ? "rgba(245,158,11,0.05)" : "#fffdf5") : "transparent" }}>
          {messages.length === 0 ? (
            <p style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: fg3 }}>No messages yet — say hello.</p>
          ) : roots.map((m) => {
            const replies = repliesByRoot.get(m.id);
            return (
              <div key={m.id}>
                {renderRow(m, false)}
                {replies && replies.length > 0 && (
                  <div style={{ marginTop: 6, marginInlineStart: 28, paddingInlineStart: 12, borderInlineStart: `2px solid ${border}`, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: fg3 }}>
                      <CornerDownRight size={12} /> {replies.length} {replies.length === 1 ? "reply" : "replies"}
                    </div>
                    {replies.map((r) => renderRow(r, true))}
                  </div>
                )}
              </div>
            );
          })}
          {typers.length > 0 && (
            <div aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: fg3, paddingInlineStart: 2 }}>
              <span className="rd-typing-dots" aria-hidden style={{ display: "inline-flex", gap: 2 }}>
                <span /><span /><span />
              </span>
              {typers.length === 1 ? `${typers[0].name} is typing…` : typers.length === 2 ? `${typers[0].name} and ${typers[1].name} are typing…` : `${typers[0].name} and ${typers.length - 1} others are typing…`}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* composer */}
        <div style={{ borderTop: `1px solid ${border}`, padding: 12 }}>
          {replyingTo && (
            <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8, borderRadius: 10, border: `1px solid ${border}`, background: surface2, padding: "6px 10px", fontSize: 12, color: fg2 }}>
              <CornerDownRight size={14} color={fg3} style={{ flexShrink: 0 }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                Replying to <strong style={{ color: fg1 }}>{replyingTo.authorId === currentUserId ? "yourself" : replyingTo.authorName}</strong>
                <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: fg3 }}>{replyingTo.body || (replyingTo.attachmentName ? `📎 ${replyingTo.attachmentName}` : "")}</span>
              </span>
              <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="rd-focus" style={{ background: "none", border: "none", cursor: "pointer", color: fg3, flexShrink: 0 }}><X size={14} /></button>
            </div>
          )}
          {(!isClient || file) && (
            <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {!isClient && <div style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, border: `1px solid ${banner.bd}`, background: banner.bg, color: banner.fg, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>{banner.icon} {banner.label}</div>}
              {file && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, border: `1px solid ${border}`, background: surface2, padding: "4px 10px", fontSize: 11, fontWeight: 500, color: fg1 }}><Paperclip size={12} /><span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span><button type="button" onClick={() => setFile(null)} aria-label="Remove attachment" style={{ background: "none", border: "none", cursor: "pointer", color: fg3 }}><X size={12} /></button></span>}
            </div>
          )}
          <input ref={fileRef} type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); e.target.value = ""; }} />
          <RichComposer
            participants={participants}
            placeholder="Write a message…  ( @ to mention · # to link · ⌘↵ to send )"
            sending={sending}
            canSendWhenEmpty={!!file}
            sendLabel={internal ? "Post internal" : "Send"}
            onSend={(p) => void send(p)}
            onAttach={() => fileRef.current?.click()}
            onTask={(text) => void createTaskFromChat(text)}
            onType={onType}
            showTask={!!taskContext}
            taskBusy={taskBusy}
            linkClientId={taskContext?.clientId}
            registerApi={(api) => { composerApi.current = api; }}
            border={border} surface={surface} fg1={fg1} fg2={fg2} onDark={onDark}
          />
        </div>
      </div>
      <style>{`
        .rd-msg :where(p,li,strong,h1,h2,h3,blockquote){color:${fg1} !important;}
        .rd-msg p{margin:0 0 6px;} .rd-msg p:last-child{margin-bottom:0;}
        .rd-msg ul,.rd-msg ol{margin:0 0 6px;padding-left:1.2rem;}
        .rd-msg code{color:${fg1} !important;background:${surface2} !important;border-radius:4px;padding:1px 4px;}
        .rd-msg a{color:${onDark ? "#fcd34d" : "#b45309"} !important;}
        .rd-mention{color:${onDark ? "#fcd34d" : "#b45309"};font-weight:600;}
        .rd-richeditor{outline:none;font-size:14px;color:${fg1};min-height:44px;max-height:200px;overflow-y:auto;}
        .rd-richeditor p{margin:0 0 4px;} .rd-richeditor p:last-child{margin-bottom:0;}
        .rd-richeditor ul,.rd-richeditor ol{margin:0;padding-left:1.2rem;}
        .rd-richeditor .rd-mention{color:${onDark ? "#fcd34d" : "#b45309"};font-weight:600;}
        .rd-richeditor p.is-editor-empty:first-child::before{content:attr(data-placeholder);float:left;color:${fg3};pointer-events:none;height:0;}
        .rd-bubble .rd-react-bar{opacity:0;transition:opacity .12s ease;}
        .rd-bubble:hover .rd-react-bar,.rd-bubble:focus-within .rd-react-bar{opacity:1;}
        @media (hover:none){.rd-bubble .rd-react-bar{opacity:1;}}
        @media (prefers-reduced-motion:reduce){.rd-bubble .rd-react-bar{transition:none;}}
        .rd-msg .rd-entity,.rd-richeditor .rd-entity{color:${onDark ? "#fcd34d" : "#b45309"} !important;font-weight:600;text-decoration:none;border-radius:6px;padding:0 3px;background:${onDark ? "rgba(245,158,11,0.12)" : "#fff7ed"};}
        .rd-msg .rd-entity[data-href]{cursor:pointer;}
        .rd-msg .rd-entity[data-href]:hover{text-decoration:underline;}
        .rd-msg .rd-entity--gone{color:${fg3} !important;background:${surface2} !important;font-weight:500;font-style:italic;cursor:default;}
        .rd-typing-dots span{width:5px;height:5px;border-radius:999px;background:${fg3};display:inline-block;animation:rd-typing 1.2s infinite ease-in-out;}
        .rd-typing-dots span:nth-child(2){animation-delay:.18s;} .rd-typing-dots span:nth-child(3){animation-delay:.36s;}
        @keyframes rd-typing{0%,60%,100%{opacity:.25;transform:translateY(0);}30%{opacity:1;transform:translateY(-2px);}}
        @media (prefers-reduced-motion:reduce){.rd-typing-dots span{animation:none;opacity:.6;}}
      `}</style>
    </>
  );
  return bare ? inner : <ClientFrame>{inner}</ClientFrame>;
}

// headerless frame — no page title, just the immersive field + a readable measure
function ClientFrame({ children }: { children: React.ReactNode }) {
  return (
    <ClientPageFrame width="standard">
      <div style={{ paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>{children}</div>
    </ClientPageFrame>
  );
}

// Per-message delete confirm — owns its own open state (BaseModal). Delete wiring unchanged.
function DeleteMessageButton({ color, onConfirm }: { color: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label="Delete message" onClick={() => setOpen(true)} className="rd-focus" style={{ display: "inline-flex", width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", background: "none", cursor: "pointer", color }}><Trash2 size={12} /></button>
      <BaseModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Delete this message?"
        size="sm"
        footer={<>
          <Button appearance="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <EmberButton onClick={() => { setOpen(false); onConfirm(); }}>Delete</EmberButton>
        </>}
      >
        <p style={{ margin: 0, fontSize: 14, color: tokens.colorNeutralForeground2 }}>It will be removed for everyone. This can&apos;t be undone.</p>
      </BaseModal>
    </>
  );
}
