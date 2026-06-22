"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";

import { assignUserAction, unassignUserAction } from "@/lib/actions/users";
import {
  BaseModal, Select, Button, EmberButton,
} from "@/components/redesign/ui";
import { usePanel } from "./ui";

export type TeamMember = { id: string; full_name: string | null; email: string | null; };

type Props = {
  clientId: string;
  team: TeamMember[];
  assignedIds: string[];
};

/** Inline confirm for unassigning a member — mirrors the kit ConfirmDelete idiom
 * (themed DialogSurface + red EmberButton) but with a text "Remove" trigger + wording. */
function RemoveAssignment({
  name, disabled, onConfirm,
}: {
  name: string; disabled?: boolean; onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { fg3 } = usePanel();
  return (
    <>
      <Button appearance="subtle" size="small" disabled={disabled} onClick={() => setOpen(true)}>Remove</Button>
      <BaseModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`Remove ${name}?`}
        size="sm"
        footer={<>
          <Button appearance="subtle" onClick={() => setOpen(false)}>Cancel</Button>
          <EmberButton onClick={() => { setOpen(false); onConfirm(); }} style={{ background: "linear-gradient(180deg,#dc2626,#b91c1c)" }}>Remove</EmberButton>
        </>}
      >
        <p style={{ margin: 0, fontSize: 14, color: fg3 }}>
          They&apos;ll immediately lose access to this client&apos;s workspace. You can reassign them anytime.
        </p>
      </BaseModal>
    </>
  );
}

/** R3 staff team-assignment manager (re-skinned, SOLID rows). All wiring verbatim. */
export function AssignmentManager({ clientId, team, assignedIds }: Props) {
  const router = useRouter();
  const { panel, fg1, fg3 } = usePanel();
  const [pending, setPending] = useState(false);
  const [toAdd, setToAdd] = useState<string>("");

  const assigned = team.filter((t) => assignedIds.includes(t.id));
  const available = team.filter((t) => !assignedIds.includes(t.id));

  async function add() {
    if (!toAdd) return;
    setPending(true);
    const res = await assignUserAction(clientId, toAdd);
    setPending(false);
    if (!res.ok) return toast.error("Couldn't assign", { description: res.error });
    toast.success("Assigned.");
    setToAdd("");
    router.refresh();
  }

  async function remove(userId: string) {
    setPending(true);
    const res = await unassignUserAction(clientId, userId);
    setPending(false);
    if (!res.ok) return toast.error("Couldn't unassign", { description: res.error });
    toast.success("Unassigned.");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {assigned.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: fg3 }}>
          <Users size={16} /> No team members assigned yet.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {assigned.map((m) => (
            <li
              key={m.id}
              className={panel}
              style={{ borderRadius: 16, padding: "0.85rem 1rem", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}
            >
              <span style={{ minWidth: 0, fontSize: 14, color: fg1 }}>
                {m.full_name ?? m.email}
                {m.full_name && m.email && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: fg3 }}>{m.email}</span>
                )}
              </span>
              <RemoveAssignment name={m.full_name ?? m.email ?? "this member"} disabled={pending} onConfirm={() => remove(m.id)} />
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.6rem" }}>
          <Select
            value={toAdd}
            onChange={(e) => setToAdd(e.target.value)}
            aria-label="Add a team member"
            style={{ minWidth: "16rem" }}
          >
            <option value="">Add a team member…</option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>
            ))}
          </Select>
          <Button appearance="primary" icon={<UserPlus size={16} />} onClick={add} disabled={pending || !toAdd}>
            Assign
          </Button>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: fg3 }}>All team members are assigned.</p>
      )}
    </div>
  );
}
