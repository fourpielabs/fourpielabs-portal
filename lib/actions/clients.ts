"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { mapEmailSendError } from "@/lib/auth/email-errors";
import {
  clientCreateSchema,
  clientUpdateSchema,
  type ClientCreateValues,
  type ClientUpdateValues,
} from "@/lib/schemas";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const STATUSES = ["onboarding", "active", "paused", "churned"] as const;
type ClientStatus = (typeof STATUSES)[number];

function clean(v: string | undefined | null) {
  return v && v.length > 0 ? v : null;
}

/** Create a client. For a `program` client the DB AFTER INSERT trigger seeds the
 * checklist, milestones, and program-specific metric definitions; a `project`
 * client is seeded NOTHING (it uses the projects board). Optionally provisions a
 * client portal user (welcome email + secure set-password link). Admin only. */
export async function createClientAction(
  input: ClientCreateValues,
): Promise<Result<{ id: string; inviteError?: string }>> {
  const admin = await requireRole(["admin"]);
  const parsed = clientCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: v.name,
      slug: v.slug,
      industry: v.industry,
      // project clients have no program tier (field is hidden); store a neutral
      // baseline so the NOT NULL column stays consistent (it's never read for them).
      program: v.client_type === "project" ? "foundation" : v.program,
      client_type: v.client_type,
      status: v.status,
      website_url: clean(v.website_url),
      start_date: clean(v.start_date),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `Slug "${v.slug}" is already taken.` };
    }
    return { ok: false, error: error.message };
  }

  await logAudit({
    actorId: admin.id,
    action: "client.created",
    entity: "client",
    entityId: data.id,
    clientId: data.id,
    metadata: { name: v.name, slug: v.slug, program: v.program, client_type: v.client_type },
  });

  // Optional: provision the client portal user via the welcome/invite email.
  // The handle_new_user trigger reads role/client_id/full_name from the invite
  // metadata; the link routes through the prefetch-safe /auth/confirm → set
  // password. NO plaintext password is ever generated or sent.
  const email = clean(v.client_email);
  let inviteError: string | undefined;
  if (email) {
    const adminClient = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          role: "client",
          client_id: data.id,
          full_name: clean(v.client_full_name),
        },
        redirectTo: `${siteUrl}/auth/confirm?next=/accept-invite`,
      },
    );
    if (inviteErr) {
      const status = (inviteErr as { status?: number }).status;
      console.error("client-user provisioning failed:", {
        email,
        clientId: data.id,
        status,
        message: inviteErr.message,
      });
      await logAudit({
        actorId: admin.id,
        action: "user.invite_failed",
        entity: "invitation",
        clientId: data.id,
        metadata: { email, role: "client", status: status ?? null, error: inviteErr.message },
      });
      inviteError = mapEmailSendError(inviteErr.message, status, { adminViewer: true });
    } else {
      await supabase.from("invitations").insert({
        email,
        role: "client",
        client_id: data.id,
        invited_by: admin.id,
      });
      await logAudit({
        actorId: admin.id,
        action: "user.invited",
        entity: "invitation",
        clientId: data.id,
        metadata: { email, role: "client" },
      });
    }
  }

  revalidatePath("/clients");
  revalidatePath("/admin/users");
  return { ok: true, data: { id: data.id, inviteError } };
}

/** Update editable client fields. Admin only. */
export async function updateClientAction(
  input: ClientUpdateValues,
): Promise<Result> {
  const admin = await requireRole(["admin"]);
  const parsed = clientUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({
      name: v.name,
      industry: v.industry,
      program: v.program,
      status: v.status,
      website_url: clean(v.website_url),
      start_date: clean(v.start_date),
      service_type: clean(v.service_type),
      investment: clean(v.investment),
      comms_channel: clean(v.comms_channel),
      internal_notes: clean(v.internal_notes),
    })
    .eq("id", v.id);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: admin.id,
    action: "client.updated",
    entity: "client",
    entityId: v.id,
    clientId: v.id,
    metadata: { name: v.name, status: v.status },
  });

  revalidatePath(`/clients/${v.id}/settings`);
  revalidatePath("/clients");
  return { ok: true };
}

/** Change client status (soft-delete = set to paused/churned). Admin only. */
export async function setClientStatusAction(
  clientId: string,
  status: ClientStatus,
): Promise<Result> {
  const admin = await requireRole(["admin"]);
  if (!STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ status })
    .eq("id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: admin.id,
    action: "client.status_changed",
    entity: "client",
    entityId: clientId,
    clientId,
    metadata: { status },
  });

  revalidatePath(`/clients/${clientId}/settings`);
  revalidatePath("/clients");
  return { ok: true };
}
