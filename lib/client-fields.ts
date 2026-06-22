/**
 * 3c — the CURATED allowlist of client-safe editable fields (deny-by-default).
 *
 * This is the ONLY set of fields an admin may grant a client permission to edit, and the
 * ONLY set the `client_update_profile_field` RPC will touch. Invariant-carrying fields
 * (status/approval/visibility/assignee/staff due_date/program/internal_notes/…) are
 * DELIBERATELY ABSENT — they are not options here, not columns in client_field_permissions,
 * and not in the RPC's settable set. Adding a key here must always be a genuinely safe,
 * non-escalating field (see docs/features/client-settings/3c/permission-model.md).
 */
export type ClientEditableField = "website_url" | "comms_channel";

export type ClientFieldPermissions = {
  can_edit_website_url: boolean;
  can_edit_comms_channel: boolean;
};

export const CLIENT_FIELD_PERMISSION_DEFAULTS: ClientFieldPermissions = {
  can_edit_website_url: false,
  can_edit_comms_channel: false,
};

export const CLIENT_EDITABLE_FIELDS: {
  key: ClientEditableField;
  permKey: keyof ClientFieldPermissions;
  label: string;
  hint: string;
}[] = [
  { key: "website_url", permKey: "can_edit_website_url", label: "Website", hint: "The client's own business website" },
  { key: "comms_channel", permKey: "can_edit_comms_channel", label: "Preferred contact channel", hint: "How they like to be reached (free text)" },
];
