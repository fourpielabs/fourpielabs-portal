"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bold, Italic, Lock, Eye, Paperclip, Pencil, Search, Send, Smile, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageTaskButton } from "@/components/tasks/message-task-button";
import { MessageAttachment } from "@/components/messaging/message-attachment";
import type { TaskMember } from "@/lib/tasks";
import {
  postMessageAction,
  getThreadMessagesAction,
  markThreadViewedAction,
  getThreadParticipantsAction,
  editMessageAction,
  deleteMessageAction,
  searchThreadMessagesAction,
  type ThreadMessage,
  type ThreadParticipant,
} from "@/lib/actions/messages";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { uploadMessageAttachmentAction } from "@/lib/actions/message-attachments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type ConversationTaskContext = {
  role: "client" | "staff";
  clientId: string;
  members: TaskMember[];
};

// curated set — no emoji-picker dependency (keeps the bundle lean, post-Batch-1.5)
const EMOJIS = [
  "👍", "🙏", "🎉", "🔥", "✅", "👀", "💪", "😄", "🙌", "❤️", "🚀", "💡",
  "📈", "⭐", "👏", "🤝", "✨", "📝", "⏰", "💬", "🎯", "👋", "🤔", "😊",
  "💯", "🆗", "📌", "⚡", "🥳", "😅", "🙂", "🫶",
];

export function Conversation({
  threadId,
  notifLink,
  currentUserId,
  currentUserName,
  initialMessages,
  audience,
  taskContext,
}: {
  threadId: string;
  notifLink: string;
  currentUserId: string;
  currentUserName: string;
  initialMessages: ThreadMessage[];
  audience: "shared" | "internal";
  taskContext?: ConversationTaskContext;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // @mentions: thread participants (RLS-gated; internal → staff only, never the
  // client), the users mentioned so far, and the active "@query" for the dropdown.
  const [participants, setParticipants] = useState<ThreadParticipant[]>([]);
  const [mentions, setMentions] = useState<ThreadParticipant[]>([]);
  const [mention, setMention] = useState<{ query: string; at: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ThreadMessage[] | null>(null);

  // keep a ref to the current messages so the realtime callback computes "after"
  // from fresh state (its closure would otherwise be stale).
  const messagesRef = useRef(initialMessages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  // ids the user optimistically deleted — kept filtered out of ANY refetch until the
  // server confirms, so a concurrent refetch (e.g. an edit's UPDATE echo) can't
  // resurrect a message we just removed.
  const removedRef = useRef<Set<string>>(new Set());

  // Incremental sync: fetch only messages AFTER our latest real one (RLS-scoped —
  // never the raw realtime payload, so the internal boundary holds), then append:
  // dedup by id + drop the optimistic twin of our own just-confirmed message.
  // Replaces the old "refetch the whole thread on every event".
  const syncNew = async () => {
    const cur = messagesRef.current;
    const lastReal = [...cur].reverse().find((m) => !m.id.startsWith("tmp-"));
    const fresh = await getThreadMessagesAction(threadId, lastReal?.createdAt).catch(
      () => [] as ThreadMessage[],
    );
    if (!fresh.length) return;
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const add = fresh.filter((m) => !ids.has(m.id) && !removedRef.current.has(m.id));
      if (!add.length) return prev;
      const mineBodies = new Set(
        add.filter((m) => m.authorId === currentUserId).map((m) => m.body.trim()),
      );
      const cleaned = mineBodies.size
        ? prev.filter((m) => !(m.id.startsWith("tmp-") && mineBodies.has(m.body.trim())))
        : prev;
      return [...cleaned, ...add];
    });
  };

  // Full re-fetch (RLS-scoped) for UPDATE events — reflects an edit's new body and
  // drops a now-soft-deleted message (RLS excludes deleted). Edits/deletes are rare,
  // so the full fetch is fine; new messages still use the incremental syncNew above.
  const fullRefetch = () =>
    getThreadMessagesAction(threadId)
      .then((msgs) => setMessages(msgs.filter((m) => !removedRef.current.has(m.id))))
      .catch(() => {});

  function startEdit(m: ThreadMessage) {
    setEditingId(m.id);
    setEditBody(m.body);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditBody("");
  }
  async function saveEdit(m: ThreadMessage) {
    const text = editBody.trim();
    if (!text) return;
    const prevBody = m.body;
    const prevEdited = m.editedAt;
    setMessages((xs) => xs.map((x) => (x.id === m.id ? { ...x, body: text, editedAt: new Date().toISOString() } : x)));
    setEditingId(null);
    setEditBody("");
    const res = await editMessageAction(m.id, text);
    if (!res.ok) {
      setMessages((xs) => xs.map((x) => (x.id === m.id ? { ...x, body: prevBody, editedAt: prevEdited } : x)));
      toast.error("Couldn't edit", { description: res.error });
    }
  }
  async function deleteMessage(m: ThreadMessage) {
    removedRef.current.add(m.id);
    const snapshot = messagesRef.current;
    setMessages((xs) => xs.filter((x) => x.id !== m.id)); // optimistic removal
    const res = await deleteMessageAction(m.id);
    if (!res.ok) {
      removedRef.current.delete(m.id);
      setMessages(snapshot);
      toast.error("Couldn't delete", { description: res.error });
    }
  }

  // composer helpers (emoji insert + markdown formatting) — operate at the cursor
  function insertAtCursor(text: string) {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? body.length;
    const end = ta?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + text + body.slice(end));
    requestAnimationFrame(() => {
      const pos = start + text.length;
      ta?.focus();
      ta?.setSelectionRange(pos, pos);
    });
  }
  function wrapSelection(marker: string) {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? body.length;
    const end = ta?.selectionEnd ?? body.length;
    const sel = body.slice(start, end) || "text";
    setBody(body.slice(0, start) + marker + sel + marker + body.slice(end));
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(start + marker.length, start + marker.length + sel.length);
    });
  }

  useEffect(() => {
    getThreadParticipantsAction(threadId).then(setParticipants).catch(() => {});
  }, [threadId]);

  // in-thread search — RLS-scoped action (a client searches ONLY their shared thread)
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(() => {
      searchThreadMessagesAction(threadId, q).then(setSearchResults).catch(() => setSearchResults(null));
    }, 300);
    return () => clearTimeout(t);
  }, [search, threadId]);

  function detectMention(value: string, caret: number) {
    const at = value.slice(0, caret).lastIndexOf("@");
    if (at < 0) return null;
    if (at > 0 && !/\s/.test(value[at - 1])) return null; // @ must start a word
    const token = value.slice(at + 1, caret);
    if (/\s/.test(token)) return null; // a space closes the token
    return { query: token, at };
  }
  function onBodyChange(value: string, caret: number) {
    setBody(value);
    setMention(detectMention(value, caret));
  }
  function pickMention(p: ThreadParticipant) {
    if (!mention) return;
    const caret = taRef.current?.selectionStart ?? body.length;
    const before = body.slice(0, mention.at);
    const insert = `@${p.name} `;
    const next = `${before}${insert}${body.slice(caret)}`;
    setBody(next);
    setMentions((xs) => (xs.some((m) => m.id === p.id) ? xs : [...xs, p]));
    setMention(null);
    requestAnimationFrame(() => {
      const pos = before.length + insert.length;
      taRef.current?.focus();
      taRef.current?.setSelectionRange(pos, pos);
    });
  }
  const mentionMatches = mention
    ? participants.filter((p) => p.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6)
    : [];

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
            void syncNew();
            void markThreadViewedAction(threadId, notifLink);
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
          () => void fullRefetch(), // an edit or soft-delete by the other party
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
    if ((!text && !file) || sending) return;
    setSending(true);
    // mentions still present in the text (deleting the @name removes the mention)
    const mentionedIds = mentions.filter((m) => text.includes(`@${m.name}`)).map((m) => m.id);

    // upload the attachment first (RLS-gated; service-role write) — then post
    let attachmentPath: string | undefined;
    let attachmentName: string | undefined;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await uploadMessageAttachmentAction(threadId, fd);
      if (!up.ok) {
        setSending(false);
        return toast.error("Attachment failed", { description: up.error });
      }
      attachmentPath = up.path;
      attachmentName = up.name;
    }

    // optimistic append — only ever YOUR OWN message
    const tmp: ThreadMessage = {
      id: `tmp-${Date.now()}`,
      body: text,
      authorId: currentUserId,
      authorName: currentUserName,
      authorRole: null,
      createdAt: new Date().toISOString(),
      attachmentName: attachmentName ?? null,
      editedAt: null,
    };
    setMessages((xs) => [...xs, tmp]);
    setBody("");
    setMention(null);
    setFile(null);
    const res = await postMessageAction(threadId, text, mentionedIds, attachmentPath, attachmentName);
    setSending(false);
    if (!res.ok) {
      setMessages((xs) => xs.filter((m) => m.id !== tmp.id));
      setBody(text);
      return toast.error("Message not sent", { description: res.error });
    }
    setMentions([]);
    void syncNew(); // reconcile our optimistic tmp → the real row (incremental)
  }

  const internal = audience === "internal";
  const banner = internal
    ? { cls: "border-amber-300 bg-amber-50 text-amber-900", icon: <Lock className="size-3.5" />, label: "Internal — the client cannot see this" }
    : { cls: "border-emerald-300 bg-emerald-50 text-emerald-900", icon: <Eye className="size-3.5" />, label: "Visible to the client" };

  return (
    <div className="flex h-[70vh] min-h-[440px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-e1">
      {/* in-thread search (RLS-scoped — a client searches only their shared thread) */}
      <div className="relative border-b border-border p-2">
        <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5">
          <Search className="size-3.5 shrink-0 text-ink-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search this conversation…"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-3"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="shrink-0 text-ink-3 hover:text-ink">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {searchResults !== null && (
          <div className="absolute inset-x-2 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-surface shadow-e2">
            {searchResults.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-ink-3">No matches in this conversation.</p>
            ) : (
              searchResults.map((r) => (
                <div key={r.id} className="border-b border-row-divider px-3 py-2 last:border-0">
                  <div className="flex items-center gap-2 text-[11px] text-ink-3">
                    <span className="font-semibold text-ink-2">{r.authorId === currentUserId ? "You" : r.authorName}</span>
                    <span className="tabular-nums">{formatRelative(r.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 text-[13px] text-ink">{r.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

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
                    {m.editedAt && <span className="text-ink-faint">· edited</span>}
                    {taskContext && !m.id.startsWith("tmp-") && (
                      <MessageTaskButton
                        messageId={m.id}
                        messageBody={m.body}
                        role={taskContext.role}
                        clientId={taskContext.clientId}
                        members={taskContext.members}
                        audience={audience}
                      />
                    )}
                    {mine && !m.id.startsWith("tmp-") && editingId !== m.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          aria-label="Edit message"
                          className="motion-micro inline-flex size-5 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              aria-label="Delete message"
                              className="motion-micro inline-flex size-5 items-center justify-center rounded-full text-ink-3 hover:bg-danger-bg hover:text-danger-text"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this message?</AlertDialogTitle>
                              <AlertDialogDescription>
                                It will be removed for everyone. This can&apos;t be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => deleteMessage(m)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                  {editingId === m.id ? (
                    <div className="mt-1 flex flex-col gap-1.5">
                      <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={2}
                        autoFocus
                        className="resize-none text-[14px]"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") cancelEdit();
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            void saveEdit(m);
                          }
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => void saveEdit(m)} disabled={!editBody.trim()}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {m.body && <Markdown className="text-[14px]">{m.body}</Markdown>}
                      {m.attachmentName &&
                        (m.id.startsWith("tmp-") ? (
                          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink-3">
                            <Paperclip className="size-3.5" /> {m.attachmentName}
                          </span>
                        ) : (
                          <MessageAttachment messageId={m.id} name={m.attachmentName} />
                        ))}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* composer — the who-can-see-this indicator is unmissable for BOTH audiences */}
      <div className="border-t border-border p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", banner.cls)}>
            {banner.icon} {banner.label}
          </div>
          {file && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink">
              <Paperclip className="size-3" />
              <span className="max-w-[160px] truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} aria-label="Remove attachment" className="text-ink-3 hover:text-ink">
                <X className="size-3" />
              </button>
            </span>
          )}
          {/* formatting toolbar — emoji picker + markdown helpers (insert at the cursor) */}
          <div className="ml-auto flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Insert emoji"
                  title="Emoji"
                  className="inline-flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <Smile className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto p-2">
                <div className="grid grid-cols-8 gap-0.5">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => insertAtCursor(e)}
                      className="rounded p-1 text-lg leading-none hover:bg-surface-2"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => wrapSelection("**")}
              aria-label="Bold (markdown **)"
              title="Bold"
              className="inline-flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <Bold className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection("*")}
              aria-label="Italic (markdown *)"
              title="Italic"
              className="inline-flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <Italic className="size-3.5" />
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            e.target.value = "";
          }}
        />
        <div className="relative flex items-end gap-2">
          {mention && mentionMatches.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-64 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-e2">
              {mentionMatches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-mention-option
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickMention(p);
                  }}
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm hover:bg-surface-2"
                >
                  <span className="text-ink-3">@</span>
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <Textarea
            ref={taRef}
            value={body}
            onChange={(e) => onBodyChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onKeyUp={(e) => setMention(detectMention(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length))}
            onClick={(e) => setMention(detectMention(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length))}
            onBlur={() => setTimeout(() => setMention(null), 150)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setMention(null);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="Write a message… (markdown · @ to mention · ⌘↵ to send)"
            className="resize-none"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            aria-label="Attach a file"
            title="Attach a file"
          >
            <Paperclip className="size-4" />
          </Button>
          <Button onClick={() => void send()} loading={sending} disabled={!body.trim() && !file}>
            <Send className="size-4" /> {internal ? "Post internal" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
