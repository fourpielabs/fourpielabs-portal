"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Megaphone, Pencil, Pin, PinOff, Plus } from "lucide-react";

import { setUpdateFlagsAction, deleteUpdateAction } from "@/lib/actions/updates";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/redesign/ui";
import { UpdateDialog, type UpdateRow } from "@/components/updates/update-dialog";
import { usePanel, EmptyPanel, ConfirmDelete, IconButton } from "./ui";

export type UpdateItem = UpdateRow & {
  author_id: string | null;
  author_name: string;
  created_at: string;
};

/** R3 staff updates list (re-skinned, SOLID cards). All wiring verbatim. */
export function UpdatesList({
  clientId,
  updates,
  currentUserId,
  isAdmin,
}: {
  clientId: string;
  updates: UpdateItem[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { panel, fg1, fg3, onDark, border } = usePanel();
  const [pending, setPending] = useState(false);

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }

  const ordered = [...updates].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.created_at < b.created_at ? 1 : -1;
  });

  const addBtn = (
    <UpdateDialog
      clientId={clientId}
      trigger={<Button appearance="primary" icon={<Plus size={16} />}>Post update</Button>}
    />
  );
  const pillBase: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 999, whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: fg3 }}>
          {updates.length === 0 ? "No updates yet." : `${updates.length} posted`}
        </p>
        {addBtn}
      </div>

      {ordered.length === 0 ? (
        <EmptyPanel
          icon={<Megaphone size={22} />}
          title="No updates yet"
          description="Share progress notes with the client here."
          action={addBtn}
        />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {ordered.map((u) => {
            const canEdit = isAdmin || u.author_id === currentUserId;
            return (
              <li key={u.id} className={panel} style={{ borderRadius: 18, padding: "1rem 1.1rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: fg1 }}>{u.title}</span>
                    {u.pinned && (
                      <span style={{ ...pillBase, background: onDark ? "rgba(245,158,11,0.16)" : "#fef3c7", color: onDark ? "#fcd34d" : "#92400e" }}>pinned</span>
                    )}
                    {!u.visible_to_client && (
                      <span style={{ ...pillBase, background: "transparent", color: fg3, border: `1px solid ${border}` }}>hidden</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 4 }}>
                    <IconButton label="Toggle pin" disabled={pending || !canEdit} onClick={() => run(setUpdateFlagsAction(clientId, u.id, { pinned: !u.pinned }))}>
                      {u.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                    </IconButton>
                    <IconButton label="Toggle visibility" disabled={pending || !canEdit} onClick={() => run(setUpdateFlagsAction(clientId, u.id, { visible_to_client: !u.visible_to_client }))}>
                      {u.visible_to_client ? <Eye size={16} /> : <EyeOff size={16} />}
                    </IconButton>
                    {canEdit && (
                      <UpdateDialog clientId={clientId} update={u} trigger={<button type="button" aria-label="Edit" className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}><Pencil size={16} /></button>} />
                    )}
                    {canEdit && (
                      <ConfirmDelete title="Delete update?" description={`“${u.title}” will be permanently removed.`} onConfirm={() => run(deleteUpdateAction(clientId, u.id))} />
                    )}
                  </div>
                </div>
                {u.body && (
                  <div className="rd-prose rd-msg" style={{ paddingTop: "0.6rem" }}>
                    <Markdown>{u.body}</Markdown>
                  </div>
                )}
                <p style={{ margin: "0.6rem 0 0", fontSize: 12, color: fg3 }}>
                  {u.author_name} · {formatDate(u.created_at)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
