"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";

import { Switch, EmberButton } from "@/components/redesign/ui";
import { usePanel } from "./ui";
import { setClientFieldPermissionsAction } from "@/lib/actions/client-permissions";
import { CLIENT_EDITABLE_FIELDS, type ClientFieldPermissions } from "@/lib/client-fields";

/**
 * ADMIN-ONLY: toggle which CURATED safe fields this client may edit (deny-by-default).
 * ONLY the curated allowlist appears here — invariant-carrying fields (status, approval,
 * visibility, assignee, due_date, program, …) are NOT options and never will be (the floor
 * lives server-side in the RPC + RLS, not in this UI).
 */
export function ClientPermissionsPanel({
  clientId,
  permissions,
}: {
  clientId: string;
  permissions: ClientFieldPermissions;
}) {
  const router = useRouter();
  const { fg1, fg3, onDark, border } = usePanel();
  const [state, setState] = useState<ClientFieldPermissions>(permissions);
  const [saving, setSaving] = useState(false);
  const dirty = state.can_edit_website_url !== permissions.can_edit_website_url || state.can_edit_comms_channel !== permissions.can_edit_comms_channel;

  async function save() {
    setSaving(true);
    const res = await setClientFieldPermissionsAction(clientId, state);
    setSaving(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success("Permissions updated.");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {CLIENT_EDITABLE_FIELDS.map((f) => (
          <label key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderRadius: 12, border: `1px solid ${border}`, padding: "0.7rem 0.9rem", cursor: "pointer" }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: fg1 }}>{f.label}</span>
              <span style={{ display: "block", fontSize: 12, color: fg3 }}>{f.hint}</span>
            </span>
            <Switch
              checked={state[f.permKey]}
              onChange={(_, d) => setState((s) => ({ ...s, [f.permKey]: d.checked }))}
              aria-label={`Allow client to edit ${f.label}`}
            />
          </label>
        ))}
      </div>
      <p style={{ margin: 0, display: "inline-flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: fg3 }}>
        <Lock size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        Status, approvals, visibility, assignee and due dates are never client-editable — they aren&rsquo;t options here and stay locked regardless of these toggles.
      </p>
      <div>
        <EmberButton onClick={save} loading={saving} disabled={!dirty}>Save permissions</EmberButton>
      </div>
    </div>
  );
}
