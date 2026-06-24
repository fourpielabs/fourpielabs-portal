"use client";

import * as React from "react";
import { useEditor, EditorContent, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import { PluginKey } from "@tiptap/pm/state";
import { Bold, Italic, List, ListPlus, Paperclip, Send, Smile, FolderKanban, CheckSquare, Package } from "lucide-react";
import { Popover, PopoverTrigger, PopoverSurface, EmberButton, tokens } from "@/components/redesign/ui";
import { searchLinkablesAction, type LinkableEntity } from "@/lib/actions/search";
import type { ThreadParticipant } from "@/lib/actions/messages";

export type RichSendPayload = { text: string; html: string; mentionIds: string[] };
export type RichComposerApi = { clear: () => void; focus: () => void; setHTML: (html: string) => void };

// S5 # deep-link: a second mention-like inline node for entity references. Stored as
// `<span class="rd-entity" data-type="TYPE" data-id="UUID">#title</span>` in body_rich; the
// title rides only in body_rich (re-resolved per-viewer server-side, never trusted on render).
// renderText is GENERIC (#type, no title) so the plaintext `body` carries no entity title.
const EntityLink = Mention.extend({
  name: "entityLink",
  addAttributes() {
    return {
      id: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute("data-id") },
      type: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute("data-type") },
      label: { default: null, parseHTML: (el: HTMLElement) => (el.textContent || "").replace(/^#/, "") },
    };
  },
  // round-trip the AUTHORED chip when body_rich is re-parsed (e.g. composer restore on send
  // failure). Only authored chips carry data-type+data-id; the server-resolved render form
  // (data-href / --gone) is never re-parsed into the composer.
  parseHTML() {
    return [{ tag: "span.rd-entity[data-id][data-type]" }];
  },
  renderHTML({ node }) {
    return ["span", { class: "rd-entity", "data-type": String(node.attrs.type ?? ""), "data-id": String(node.attrs.id ?? "") }, `#${node.attrs.label ?? ""}`];
  },
  renderText({ node }) {
    return `#${node.attrs.type ?? "link"}`;
  },
});

const ENTITY_ICON = { project: FolderKanban, task: CheckSquare, deliverable: Package } as const;
// distinct suggestion plugin key — the default Mention suggestion uses a SHARED MentionPluginKey,
// so a second Mention-based extension MUST set its own key or the two suggestion plugins collide.
const ENTITY_SUGGESTION_KEY = new PluginKey("entityLinkSuggestion");

const EMOJIS = ["👍","🙏","🎉","🔥","✅","👀","💪","😄","🙌","❤️","🚀","💡","📈","⭐","👏","🤝","✨","📝","⏰","💬","🎯","👋","🤔","😊","💯","🆗","📌","⚡","🥳","😅","🙂","🫶"];

// Collect mention ids from the editor doc (the mention NODE carries the validated id).
function mentionIdsOf(editor: Editor): string[] {
  const ids = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.type.name === "mention" && node.attrs.id) ids.add(String(node.attrs.id));
  });
  return [...ids];
}

/**
 * TipTap WYSIWYG composer (code-split via dynamic import). Bold/Italic format INSTANTLY;
 * toolbar active-states reflect the cursor via useEditorState (the React reactivity gotcha).
 * @mentions use the TipTap Mention extension + a participant-scoped suggestion dropdown
 * (same users as before — the server still re-validates each id against the REAL thread, so
 * the internal-thread boundary holds). ⌘↵ sends. Attach/Task call back to the parent.
 */
export function RichComposer({
  participants,
  placeholder,
  sending,
  canSendWhenEmpty,
  sendLabel,
  onSend,
  onAttach,
  onTask,
  onType,
  onCancel,
  showTask,
  showAttach = true,
  taskBusy,
  linkClientId,
  initialHTML,
  autoFocus,
  registerApi,
  border,
  surface,
  fg1,
  fg2,
  onDark,
}: {
  participants: ThreadParticipant[];
  placeholder: string;
  sending: boolean;
  canSendWhenEmpty: boolean;
  sendLabel: string;
  onSend: (p: RichSendPayload) => void;
  onAttach: () => void;
  onTask?: (text: string) => void;
  onType?: () => void;
  onCancel?: () => void;      // S6: inline edit — renders a Cancel button + Esc cancels
  showTask?: boolean;
  showAttach?: boolean;       // S6: hide Attach when reused as the inline edit composer
  taskBusy?: boolean;
  linkClientId?: string; // S5: the thread's client — scopes the # entity-link suggestions (RLS-bounded)
  initialHTML?: string;      // S6: pre-fill (the message's RAW authored body_rich) for re-rich edit
  autoFocus?: boolean;
  registerApi?: (api: RichComposerApi) => void;
  border: string;
  surface: string;
  fg1: string;
  fg2: string;
  onDark: boolean;
}) {
  // mention suggestion popup state (bridges the non-React plugin callbacks → React)
  const [mentionState, setMentionState] = React.useState<{
    items: ThreadParticipant[];
    command: (item: { id: string; label: string }) => void;
    rect: DOMRect | null;
  } | null>(null);
  const selIdx = React.useRef(0);
  const [selView, setSelView] = React.useState(0);
  const participantsRef = React.useRef(participants);
  React.useEffect(() => { participantsRef.current = participants; }, [participants]);
  // the suggestion onKeyDown event only carries the keystroke — keep the live items +
  // command in refs (set by onStart/onUpdate) so keyboard nav can act on them.
  const itemsRef = React.useRef<{ id: string; name: string }[]>([]);
  const commandRef = React.useRef<((x: { id: string; label: string }) => void) | null>(null);

  // S5 entity-link (#) suggestion state — a parallel bridge to the @ one above.
  const [entityState, setEntityState] = React.useState<{ items: LinkableEntity[]; rect: DOMRect | null } | null>(null);
  const entitySelIdx = React.useRef(0);
  const [entitySelView, setEntitySelView] = React.useState(0);
  const entityItemsRef = React.useRef<LinkableEntity[]>([]);
  const entityCommandRef = React.useRef<((x: { id: string; label: string; type: string }) => void) | null>(null);
  const linkClientIdRef = React.useRef(linkClientId);
  React.useEffect(() => { linkClientIdRef.current = linkClientId; }, [linkClientId]);

  const editor = useEditor({
    immediatelyRender: false, // SSR-safe (avoids hydration mismatch)
    content: initialHTML ?? "", // S6: pre-fill for inline edit (the message's raw authored body_rich)
    autofocus: autoFocus ? "end" : false,
    onUpdate: () => onType?.(), // emit a typing signal to the parent (debounced there)
    extensions: [
      StarterKit.configure({ heading: { levels: [3] } }),
      Placeholder.configure({ placeholder }),
      /* eslint-disable react-hooks/refs -- the suggestion render/items/onKeyDown callbacks
         fire from the ProseMirror plugin OUTSIDE React render; reading a ref is the documented
         way to see fresh participants/items there (the plugin captures this config once). */
      Mention.configure({
        HTMLAttributes: { class: "rd-mention" },
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        suggestion: {
          char: "@",
          items: ({ query }) =>
            participantsRef.current
              .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 6)
              .map((p) => ({ id: p.id, name: p.name })),
          render: () => ({
            onStart: (props) => {
              const items = props.items as { id: string; name: string }[];
              itemsRef.current = items; commandRef.current = props.command as never;
              selIdx.current = 0; setSelView(0);
              setMentionState({ items: items as ThreadParticipant[], command: props.command as never, rect: props.clientRect?.() ?? null });
            },
            onUpdate: (props) => {
              const items = props.items as { id: string; name: string }[];
              itemsRef.current = items; commandRef.current = props.command as never;
              selIdx.current = 0; setSelView(0);
              setMentionState({ items: items as ThreadParticipant[], command: props.command as never, rect: props.clientRect?.() ?? null });
            },
            onKeyDown: (props) => {
              const items = itemsRef.current;
              if (!items.length) return false;
              if (props.event.key === "ArrowDown") { selIdx.current = (selIdx.current + 1) % items.length; setSelView(selIdx.current); return true; }
              if (props.event.key === "ArrowUp") { selIdx.current = (selIdx.current - 1 + items.length) % items.length; setSelView(selIdx.current); return true; }
              if (props.event.key === "Enter" || props.event.key === "Tab") {
                const it = items[Math.min(selIdx.current, items.length - 1)];
                commandRef.current?.({ id: it.id, label: it.name });
                return true;
              }
              if (props.event.key === "Escape") { setMentionState(null); return true; }
              return false;
            },
            onExit: () => { itemsRef.current = []; commandRef.current = null; setMentionState(null); },
          }),
        },
      }),
      // S5: the # entity-link picker — RLS-scoped to the thread's client (searchLinkablesAction
      // runs as the caller, so a client is only ever offered their own visible items).
      EntityLink.configure({
        suggestion: {
          char: "#",
          pluginKey: ENTITY_SUGGESTION_KEY,
          items: async ({ query }) => {
            const cid = linkClientIdRef.current;
            if (!cid) return [];
            return await searchLinkablesAction(cid, query).catch(() => [] as LinkableEntity[]);
          },
          render: () => ({
            onStart: (props) => {
              const items = props.items as LinkableEntity[];
              entityItemsRef.current = items; entityCommandRef.current = props.command as never;
              entitySelIdx.current = 0; setEntitySelView(0);
              setEntityState({ items, rect: props.clientRect?.() ?? null });
            },
            onUpdate: (props) => {
              const items = props.items as LinkableEntity[];
              entityItemsRef.current = items; entityCommandRef.current = props.command as never;
              entitySelIdx.current = 0; setEntitySelView(0);
              setEntityState({ items, rect: props.clientRect?.() ?? null });
            },
            onKeyDown: (props) => {
              const items = entityItemsRef.current;
              if (!items.length) return false;
              if (props.event.key === "ArrowDown") { entitySelIdx.current = (entitySelIdx.current + 1) % items.length; setEntitySelView(entitySelIdx.current); return true; }
              if (props.event.key === "ArrowUp") { entitySelIdx.current = (entitySelIdx.current - 1 + items.length) % items.length; setEntitySelView(entitySelIdx.current); return true; }
              if (props.event.key === "Enter" || props.event.key === "Tab") {
                const it = items[Math.min(entitySelIdx.current, items.length - 1)];
                entityCommandRef.current?.({ id: it.id, label: it.title, type: it.type });
                return true;
              }
              if (props.event.key === "Escape") { setEntityState(null); return true; }
              return false;
            },
            onExit: () => { entityItemsRef.current = []; entityCommandRef.current = null; setEntityState(null); },
          }),
        },
      }),
      /* eslint-enable react-hooks/refs */
    ],
    editorProps: {
      attributes: { class: "rd-richeditor", "aria-label": "Message" },
      handleKeyDown: (_view, event) => {
        // ⌘↵ / Ctrl↵ sends — but let the mention/entity dropdown consume Enter when open
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); doSend(); return true; }
        // Esc cancels an inline edit (only when a suggestion popup isn't open to consume it)
        if (event.key === "Escape" && onCancel && !mentionState && !entityState) { event.preventDefault(); onCancel(); return true; }
        return false;
      },
    },
  });

  React.useEffect(() => {
    if (!editor || !registerApi) return;
    registerApi({
      clear: () => editor.commands.clearContent(false), // emitUpdate=false → no spurious onType after send
      focus: () => editor.commands.focus("end"),
      setHTML: (html: string) => editor.commands.setContent(html || "<p></p>", false),
    });
  }, [editor, registerApi]);

  function doSend() {
    if (!editor || sending) return;
    const isEmpty = editor.isEmpty;
    if (isEmpty && !canSendWhenEmpty) return;
    onSend({ text: editor.getText().trim(), html: isEmpty ? "" : editor.getHTML(), mentionIds: mentionIdsOf(editor) });
  }

  // reactive toolbar active-states (the React gotcha — without this the buttons don't light up)
  const active = useEditorState({
    editor,
    selector: (ctx) => ({
      bold: ctx.editor?.isActive("bold") ?? false,
      italic: ctx.editor?.isActive("italic") ?? false,
      bullet: ctx.editor?.isActive("bulletList") ?? false,
      empty: ctx.editor?.isEmpty ?? true,
    }),
  });

  const tool = (on?: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "5px 10px",
    fontSize: "0.78rem", fontWeight: 500, cursor: "pointer", border: `1px solid ${on ? "#fcd34d" : border}`,
    background: on ? (onDark ? "rgba(245,158,11,0.16)" : "#fffaf0") : surface, color: on ? (onDark ? "#fcd34d" : "#92400e") : fg2,
  });

  return (
    <div>
      <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        <Popover positioning="above-start" withArrow>
          <PopoverTrigger disableButtonEnhancement>
            <button type="button" aria-label="Insert emoji" className="rd-focus" style={tool()}><Smile size={14} /> Emoji</button>
          </PopoverTrigger>
          <PopoverSurface style={{ padding: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 2 }}>
              {EMOJIS.map((e) => <button key={e} type="button" onClick={() => editor?.chain().focus().insertContent(e).run()} style={{ borderRadius: 6, border: "none", background: "none", cursor: "pointer", padding: 4, fontSize: 18, lineHeight: 1 }}>{e}</button>)}
            </div>
          </PopoverSurface>
        </Popover>
        <button type="button" aria-pressed={active?.bold} onClick={() => editor?.chain().focus().toggleBold().run()} aria-label="Bold" className="rd-focus" style={tool(active?.bold)}><Bold size={14} /> Bold</button>
        <button type="button" aria-pressed={active?.italic} onClick={() => editor?.chain().focus().toggleItalic().run()} aria-label="Italic" className="rd-focus" style={tool(active?.italic)}><Italic size={14} /> Italic</button>
        <button type="button" aria-pressed={active?.bullet} onClick={() => editor?.chain().focus().toggleBulletList().run()} aria-label="Bulleted list" className="rd-focus" style={tool(active?.bullet)}><List size={14} /> List</button>
        {showAttach && <button type="button" onClick={onAttach} disabled={sending} aria-label="Attach a file" className="rd-focus" style={tool()}><Paperclip size={14} /> Attach</button>}
        {showTask && <button type="button" disabled={taskBusy} onClick={() => onTask?.(editor?.getText().trim() ?? "")} aria-label="Create a task" className="rd-focus" style={tool(false)}><ListPlus size={14} /> Task</button>}
      </div>

      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, borderRadius: 10, border: `1px solid ${border}`, background: surface, padding: "8px 12px" }}>
          <EditorContent editor={editor} />
        </div>
        {onCancel && <button type="button" onClick={onCancel} className="rd-focus" style={tool()}>Cancel</button>}
        <EmberButton onClick={doSend} loading={sending} disabled={(active?.empty ?? true) && !canSendWhenEmpty} icon={<Send size={16} />}>{sendLabel}</EmberButton>

        {mentionState && mentionState.items.length > 0 && (
          <div role="listbox" aria-label="Mention a person"
            style={{ position: "fixed", zIndex: 50, left: mentionState.rect?.left ?? 0, top: (mentionState.rect?.top ?? 0) - 8, transform: "translateY(-100%)", width: 256, overflow: "hidden", borderRadius: 12, border: `1px solid ${border}`, background: surface, padding: "4px 0", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.3)" }}>
            {mentionState.items.map((p, i) => {
              const on = i === Math.min(selView, mentionState.items.length - 1);
              return (
                <button key={p.id} type="button" role="option" aria-selected={on}
                  onMouseDown={(e) => { e.preventDefault(); mentionState.command({ id: p.id, label: p.name }); }}
                  onMouseEnter={() => { selIdx.current = i; setSelView(i); }}
                  style={{ display: "flex", width: "100%", alignItems: "center", gap: 6, padding: "6px 12px", textAlign: "left", fontSize: 14, border: "none", cursor: "pointer", background: on ? (onDark ? "rgba(255,255,255,0.06)" : "#f4f4f0") : "transparent", color: fg1 }}>
                  <span style={{ color: tokens.colorNeutralForeground3 }}>@</span>{p.name}
                </button>
              );
            })}
          </div>
        )}

        {entityState && entityState.items.length > 0 && (
          <div role="listbox" aria-label="Link a project, task, or deliverable"
            style={{ position: "fixed", zIndex: 50, left: entityState.rect?.left ?? 0, top: (entityState.rect?.top ?? 0) - 8, transform: "translateY(-100%)", width: 300, maxHeight: 280, overflowY: "auto", borderRadius: 12, border: `1px solid ${border}`, background: surface, padding: "4px 0", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.3)" }}>
            {entityState.items.map((e, i) => {
              const on = i === Math.min(entitySelView, entityState.items.length - 1);
              const prev = entityState.items[i - 1];
              const Icon = ENTITY_ICON[e.type];
              const groupLabel = { project: "Projects", task: "Tasks", deliverable: "Deliverables" }[e.type];
              return (
                <React.Fragment key={`${e.type}:${e.id}`}>
                  {(!prev || prev.type !== e.type) && (
                    <div style={{ padding: "6px 12px 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: tokens.colorNeutralForeground3 }}>{groupLabel}</div>
                  )}
                  <button type="button" role="option" aria-selected={on}
                    onMouseDown={(ev) => { ev.preventDefault(); entityCommandRef.current?.({ id: e.id, label: e.title, type: e.type }); }}
                    onMouseEnter={() => { entitySelIdx.current = i; setEntitySelView(i); }}
                    style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "6px 12px", textAlign: "left", fontSize: 14, border: "none", cursor: "pointer", background: on ? (onDark ? "rgba(255,255,255,0.06)" : "#f4f4f0") : "transparent", color: fg1 }}>
                    <Icon size={14} style={{ flexShrink: 0, color: onDark ? "#fcd34d" : "#b45309" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
