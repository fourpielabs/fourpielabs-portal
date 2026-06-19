"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bold, Italic, ListPlus, Lock, Eye, Paperclip, Pencil, Search, Send, Smile, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/format";
import { useReducedMotion } from "@/lib/motion";
import { useMediaQuery } from "@/lib/use-media-query";
import { Markdown } from "@/components/markdown";
import { TaskCreateDialog } from "@/components/tasks/task-create-dialog";
import { MessageAttachment } from "@/components/messaging/message-attachment";
import type { TaskMember } from "@/lib/tasks";
import {
  postMessageAction, getThreadMessagesAction, markThreadViewedAction, getThreadParticipantsAction,
  editMessageAction, deleteMessageAction, searchThreadMessagesAction,
  type ThreadMessage, type ThreadParticipant,
} from "@/lib/actions/messages";
import { uploadMessageAttachmentAction } from "@/lib/actions/message-attachments";
import {
  Button, EmberButton, Popover, PopoverTrigger, PopoverSurface,
  Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogContent, DialogActions, tokens,
} from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";

export type ConversationTaskContext = { role: "client" | "staff"; clientId: string; members: TaskMember[] };

const EMOJIS = ["👍","🙏","🎉","🔥","✅","👀","💪","😄","🙌","❤️","🚀","💡","📈","⭐","👏","🤝","✨","📝","⏰","💬","🎯","👋","🤔","😊","💯","🆗","📌","⚡","🥳","😅","🙂","🫶"];

/**
 * R2 client Conversation (re-skinned to Warm Obsidian, mode-aware). ALL logic is
 * preserved verbatim from components/messaging/conversation.tsx: optimistic own-message
 * append, incremental syncNew, realtime (RLS-scoped refetch — never the raw payload, the
 * internal boundary's third layer), @mentions, attachments, edit/delete, in-thread
 * search. Headerless surface; left-aligned ember composer toolbar; mobile "Write a
 * message…". The page only ever passes the client_shared thread, so internal content is
 * unreachable. Native <textarea>/<input> keep the cursor/selection logic intact.
 */
export function Conversation({
  threadId, notifLink, currentUserId, currentUserName, initialMessages, audience, taskContext, bare = false,
}: {
  threadId: string; notifLink: string; currentUserId: string; currentUserName: string;
  initialMessages: ThreadMessage[]; audience: "shared" | "internal"; taskContext?: ConversationTaskContext; bare?: boolean;
}) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [participants, setParticipants] = useState<ThreadParticipant[]>([]);
  const [mentions, setMentions] = useState<ThreadParticipant[]>([]);
  const [mention, setMention] = useState<{ query: string; at: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const reduced = useReducedMotion();
  const coarse = useMediaQuery("(pointer: coarse)");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ThreadMessage[] | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);

  const messagesRef = useRef(initialMessages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const removedRef = useRef<Set<string>>(new Set());

  const syncNew = async () => {
    const cur = messagesRef.current;
    const lastReal = [...cur].reverse().find((m) => !m.id.startsWith("tmp-"));
    const fresh = await getThreadMessagesAction(threadId, lastReal?.createdAt).catch(() => [] as ThreadMessage[]);
    if (!fresh.length) return;
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const add = fresh.filter((m) => !ids.has(m.id) && !removedRef.current.has(m.id));
      if (!add.length) return prev;
      const mineBodies = new Set(add.filter((m) => m.authorId === currentUserId).map((m) => m.body.trim()));
      const cleaned = mineBodies.size ? prev.filter((m) => !(m.id.startsWith("tmp-") && mineBodies.has(m.body.trim()))) : prev;
      return [...cleaned, ...add];
    });
  };
  const fullRefetch = () =>
    getThreadMessagesAction(threadId).then((msgs) => setMessages(msgs.filter((m) => !removedRef.current.has(m.id)))).catch(() => {});

  function startEdit(m: ThreadMessage) { setEditingId(m.id); setEditBody(m.body); }
  function cancelEdit() { setEditingId(null); setEditBody(""); }
  async function saveEdit(m: ThreadMessage) {
    const text = editBody.trim();
    if (!text) return;
    const prevBody = m.body, prevEdited = m.editedAt;
    setMessages((xs) => xs.map((x) => (x.id === m.id ? { ...x, body: text, editedAt: new Date().toISOString() } : x)));
    setEditingId(null); setEditBody("");
    const res = await editMessageAction(m.id, text);
    if (!res.ok) { setMessages((xs) => xs.map((x) => (x.id === m.id ? { ...x, body: prevBody, editedAt: prevEdited } : x))); toast.error("Couldn't edit", { description: res.error }); }
  }
  async function deleteMessage(m: ThreadMessage) {
    removedRef.current.add(m.id);
    const snapshot = messagesRef.current;
    setMessages((xs) => xs.filter((x) => x.id !== m.id));
    const res = await deleteMessageAction(m.id);
    if (!res.ok) { removedRef.current.delete(m.id); setMessages(snapshot); toast.error("Couldn't delete", { description: res.error }); }
  }

  function insertAtCursor(text: string) {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? body.length, end = ta?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + text + body.slice(end));
    requestAnimationFrame(() => { const pos = start + text.length; ta?.focus(); ta?.setSelectionRange(pos, pos); });
  }
  function wrapSelection(marker: string) {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? body.length, end = ta?.selectionEnd ?? body.length;
    const hasSel = end > start, sel = body.slice(start, end);
    setBody(body.slice(0, start) + marker + sel + marker + body.slice(end));
    requestAnimationFrame(() => { ta?.focus(); if (hasSel) ta?.setSelectionRange(start + marker.length, start + marker.length + sel.length); else { const caret = start + marker.length; ta?.setSelectionRange(caret, caret); } });
  }

  useEffect(() => { getThreadParticipantsAction(threadId).then(setParticipants).catch(() => {}); }, [threadId]);
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSearchResults(null); return; }
    const t = setTimeout(() => { searchThreadMessagesAction(threadId, q).then(setSearchResults).catch(() => setSearchResults(null)); }, 300);
    return () => clearTimeout(t);
  }, [search, threadId]);

  function detectMention(value: string, caret: number) {
    const at = value.slice(0, caret).lastIndexOf("@");
    if (at < 0) return null;
    if (at > 0 && !/\s/.test(value[at - 1])) return null;
    const token = value.slice(at + 1, caret);
    if (/\s/.test(token)) return null;
    return { query: token, at };
  }
  function onBodyChange(value: string, caret: number) { setBody(value); setMention(detectMention(value, caret)); setMentionIndex(0); }
  function pickMention(p: ThreadParticipant) {
    if (!mention) return;
    const caret = taRef.current?.selectionStart ?? body.length;
    const before = body.slice(0, mention.at), insert = `@${p.name} `;
    const next = `${before}${insert}${body.slice(caret)}`;
    setBody(next);
    setMentions((xs) => (xs.some((m) => m.id === p.id) ? xs : [...xs, p]));
    setMention(null);
    requestAnimationFrame(() => { const pos = before.length + insert.length; taRef.current?.focus(); taRef.current?.setSelectionRange(pos, pos); });
  }
  const mentionMatches = mention ? participants.filter((p) => p.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6) : [];

  useEffect(() => { startTransition(() => { void markThreadViewedAction(threadId, notifLink); }); }, [threadId, notifLink, startTransition]);

  useEffect(() => {
    const supabase = createClient();
    const name = `thread-${threadId}-${Math.random().toString(36).slice(2)}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase.channel(name)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, () => { void syncNew(); void markThreadViewedAction(threadId, notifLink); })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, () => void fullRefetch())
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); }, [messages.length, reduced]);

  async function send() {
    const text = body.trim();
    if ((!text && !file) || sending) return;
    setSending(true);
    const mentionedIds = mentions.filter((m) => text.includes(`@${m.name}`)).map((m) => m.id);
    let attachmentPath: string | undefined, attachmentName: string | undefined;
    if (file) {
      const fd = new FormData(); fd.append("file", file);
      const up = await uploadMessageAttachmentAction(threadId, fd);
      if (!up.ok) { setSending(false); return toast.error("Attachment failed", { description: up.error }); }
      attachmentPath = up.path; attachmentName = up.name;
    }
    const tmp: ThreadMessage = { id: `tmp-${Date.now()}`, body: text, authorId: currentUserId, authorName: currentUserName, authorRole: null, createdAt: new Date().toISOString(), attachmentName: attachmentName ?? null, editedAt: null };
    setMessages((xs) => [...xs, tmp]); setBody(""); setMention(null); setFile(null);
    const res = await postMessageAction(threadId, text, mentionedIds, attachmentPath, attachmentName);
    setSending(false);
    if (!res.ok) { setMessages((xs) => xs.filter((m) => m.id !== tmp.id)); setBody(text); return toast.error("Message not sent", { description: res.error }); }
    setMentions([]); void syncNew();
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

  const toolBtn = (extra?: React.CSSProperties): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "5px 10px",
    fontSize: "0.78rem", fontWeight: 500, cursor: "pointer",
    border: `1px solid ${border}`, background: surface, color: fg2, ...extra,
  });

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
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, background: internal ? (onDark ? "rgba(245,158,11,0.05)" : "#fffdf5") : "transparent" }}>
          {messages.length === 0 ? (
            <p style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: fg3 }}>No messages yet — say hello.</p>
          ) : messages.map((m) => {
            const mine = m.authorId === currentUserId;
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "78%", borderRadius: 16, padding: "8px 14px", border: `1px solid ${mine ? mineBorder : border}`, background: mine ? mineBg : surface }}>
                  <div style={{ marginBottom: 2, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: fg3 }}>
                    <span style={{ fontWeight: 600, color: fg2 }}>{mine ? "You" : m.authorName}</span>
                    {!mine && m.authorRole === "client" && <span style={{ borderRadius: 999, background: surface2, padding: "1px 6px", fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: fg2 }}>Client</span>}
                    <span className="rd-tnum">{formatRelative(m.createdAt)}</span>
                    {m.editedAt && <span style={{ color: fg3 }}>· edited</span>}
                    {mine && !m.id.startsWith("tmp-") && editingId !== m.id && (
                      <>
                        <button type="button" onClick={() => startEdit(m)} aria-label="Edit message" className="rd-focus" style={{ display: "inline-flex", width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", background: "none", cursor: "pointer", color: fg3 }}><Pencil size={12} /></button>
                        <Dialog>
                          <DialogTrigger disableButtonEnhancement>
                            <button type="button" aria-label="Delete message" className="rd-focus" style={{ display: "inline-flex", width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", background: "none", cursor: "pointer", color: fg3 }}><Trash2 size={12} /></button>
                          </DialogTrigger>
                          <DialogSurface>
                            <DialogBody>
                              <DialogTitle>Delete this message?</DialogTitle>
                              <DialogContent>It will be removed for everyone. This can&apos;t be undone.</DialogContent>
                              <DialogActions>
                                <DialogTrigger disableButtonEnhancement><Button appearance="secondary">Cancel</Button></DialogTrigger>
                                <EmberButton onClick={() => deleteMessage(m)}>Delete</EmberButton>
                              </DialogActions>
                            </DialogBody>
                          </DialogSurface>
                        </Dialog>
                      </>
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
                      {m.body && <div className="rd-msg" style={{ fontSize: 14, color: fg1 }}><Markdown>{m.body}</Markdown></div>}
                      {m.attachmentName && (m.id.startsWith("tmp-") ? (
                        <span style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, border: `1px solid ${border}`, background: surface2, padding: "6px 10px", fontSize: 12, fontWeight: 500, color: fg3 }}><Paperclip size={14} /> {m.attachmentName}</span>
                      ) : (
                        <MessageAttachment messageId={m.id} name={m.attachmentName} />
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* composer */}
        <div style={{ borderTop: `1px solid ${border}`, padding: 12 }}>
          {(!isClient || file) && (
            <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {!isClient && <div style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, border: `1px solid ${banner.bd}`, background: banner.bg, color: banner.fg, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>{banner.icon} {banner.label}</div>}
              {file && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, border: `1px solid ${border}`, background: surface2, padding: "4px 10px", fontSize: 11, fontWeight: 500, color: fg1 }}><Paperclip size={12} /><span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span><button type="button" onClick={() => setFile(null)} aria-label="Remove attachment" style={{ background: "none", border: "none", cursor: "pointer", color: fg3 }}><X size={12} /></button></span>}
            </div>
          )}
          {/* left-aligned ember toolbar */}
          <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <Popover positioning="above-start" withArrow>
              <PopoverTrigger disableButtonEnhancement>
                <button type="button" aria-label="Insert emoji" className="rd-focus rd-tool" style={toolBtn()}><Smile size={14} /> Emoji</button>
              </PopoverTrigger>
              <PopoverSurface style={{ padding: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 2 }}>
                  {EMOJIS.map((e) => <button key={e} type="button" onClick={() => insertAtCursor(e)} style={{ borderRadius: 6, border: "none", background: "none", cursor: "pointer", padding: 4, fontSize: 18, lineHeight: 1 }}>{e}</button>)}
                </div>
              </PopoverSurface>
            </Popover>
            <button type="button" onClick={() => wrapSelection("**")} aria-label="Bold (markdown **)" className="rd-focus rd-tool" style={toolBtn()}><Bold size={14} /> Bold</button>
            <button type="button" onClick={() => wrapSelection("*")} aria-label="Italic (markdown *)" className="rd-focus rd-tool" style={toolBtn()}><Italic size={14} /> Italic</button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={sending} aria-label="Attach a file" className="rd-focus rd-tool" style={toolBtn(sending ? { opacity: 0.5, cursor: "not-allowed" } : undefined)}><Paperclip size={14} /> Attach</button>
            {taskContext && <button type="button" onClick={() => setTaskOpen(true)} aria-label="Create a task" className="rd-focus rd-tool" style={toolBtn()}><ListPlus size={14} /> Task</button>}
          </div>
          {taskContext && <TaskCreateDialog open={taskOpen} onOpenChange={setTaskOpen} role={taskContext.role} clientId={taskContext.clientId} members={taskContext.members} audience={audience} initialTitle={body.trim()} />}
          <input ref={fileRef} type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); e.target.value = ""; }} />
          <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 8 }}>
            {mention && mentionMatches.length > 0 && (
              <div role="listbox" aria-label="Mention a person" style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: 4, width: 256, overflow: "hidden", borderRadius: 12, border: `1px solid ${border}`, background: surface, padding: "4px 0", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.3)" }}>
                {mentionMatches.map((p, i) => {
                  const activeOpt = i === Math.min(mentionIndex, mentionMatches.length - 1);
                  return (
                    <button key={p.id} type="button" role="option" aria-selected={activeOpt} onMouseDown={(e) => { e.preventDefault(); pickMention(p); }} onMouseEnter={() => setMentionIndex(i)}
                      style={{ display: "flex", width: "100%", alignItems: "center", gap: 6, padding: "6px 12px", textAlign: "left", fontSize: 14, border: "none", cursor: "pointer", background: activeOpt ? surface2 : "transparent", color: fg1 }}>
                      <span style={{ color: fg3 }}>@</span>{p.name}
                    </button>
                  );
                })}
              </div>
            )}
            <textarea ref={taRef} value={body}
              onChange={(e) => onBodyChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
              onKeyUp={(e) => setMention(detectMention(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length))}
              onClick={(e) => setMention(detectMention(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length))}
              onBlur={() => setTimeout(() => setMention(null), 150)}
              onKeyDown={(e) => {
                if (mention && mentionMatches.length > 0) {
                  if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => (i + 1) % mentionMatches.length); return; }
                  if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
                  if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(mentionMatches[Math.min(mentionIndex, mentionMatches.length - 1)]); return; }
                }
                if (e.key === "Escape") setMention(null);
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); }
              }}
              rows={2} placeholder={coarse ? "Write a message…" : "Write a message… (markdown · @ to mention · ⌘↵ to send)"}
              style={{ flex: 1, resize: "none", borderRadius: 10, border: `1px solid ${border}`, background: surface, color: fg1, padding: "8px 12px", fontSize: 14, outline: "none", fontFamily: "var(--font-inter), Inter, sans-serif" }} />
            <EmberButton onClick={() => void send()} loading={sending} disabled={!body.trim() && !file} icon={<Send size={16} />}>{internal ? "Post internal" : "Send"}</EmberButton>
          </div>
        </div>
      </div>
      <style>{`
        .rd-tool:hover{border-color:#fcd34d !important;background:${onDark ? "rgba(245,158,11,0.12)" : "#fffaf0"} !important;color:${onDark ? "#fcd34d" : "#92400e"} !important;}
        .rd-msg :where(p,li,strong,h1,h2,h3,blockquote){color:${fg1} !important;}
        .rd-msg code{color:${fg1} !important;background:${surface2} !important;}
        .rd-msg a{color:${onDark ? "#fcd34d" : "#b45309"} !important;}
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
