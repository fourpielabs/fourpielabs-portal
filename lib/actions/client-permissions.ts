"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireProfile } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import {
  type ClientEditableField,
  type ClientFieldPermissions,
} from "@/lib/client-fields";

type Result = { ok: true } | { ok: false; error: string };

/**
 * ADMIN-ONLY: set which curated safe fields a client may edit (deny-by-default allowlist).
 * Only the two known permission booleans are written — there is no path to grant a locked
 * field (none exist as columns). Audited.
 */
export async function setClientFieldPermissionsAction(
  clientId: string,
  perms: Partial<ClientFieldPermissions>,
): Promise<Result> {
  const admin = await requireRole(["admin"]);
  const supabase = await createClient();
  const row = {
    client_id: clientId,
    can_edit_website_url: !!perms.can_edit_website_url,
    can_edit_comms_channel: !!perms.can_edit_comms_channel,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("client_field_permissions")
    .upsert(row, { onConflict: "client_id" });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: admin.id,
    action: "client_permissions.updated",
    entity: "client_field_permissions",
    entityId: clientId,
    clientId,
    metadata: { can_edit_website_url: row.can_edit_website_url, can_edit_comms_channel: row.can_edit_comms_channel },
  });
  revalidatePath(`/clients/${clientId}/settings`);
  return { ok: true };
}

const valueSchema: Record<ClientEditableField, z.ZodTypeAny> = {
  website_url: z.string().trim().url("Enter a valid URL").or(z.literal("")),
  comms_channel: z.string().trim().max(200, "Too long"),
};

/**
 * CLIENT edit of a granted safe field. The RPC is the floor: it re-validates the caller is
 * a client, that the per-client grant is true (deny-by-default), and only ever touches the
 * one safe column. This action just forwards + audits; it grants nothing on its own.
 */
export async function clientUpdateProfileFieldAction(
  field: ClientEditableField,
  value: string,
): Promise<Result> {
  const me = await requireProfile();
  const schema = valueSchema[field];
  if (!schema) return { ok: false, error: "Unknown field" };
  const parsed = schema.safeParse(value);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid value" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("client_update_profile_field", { p_field: field, p_value: value });
  if (error) {
    // RPC raises 'Not permitted to edit …' / 'Field … is not client-editable' / 'Not a client'
    return { ok: false, error: error.message.includes("Not permitted") ? "You don't have permission to edit this field." : error.message };
  }

  await logAudit({
    actorId: me.id,
    action: "client.field_edited",
    entity: "clients",
    entityId: me.client_id ?? undefined,
    clientId: me.client_id ?? undefined,
    metadata: { field },
  });
  revalidatePath("/settings");
  return { ok: true };
}
