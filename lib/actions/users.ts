"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { inviteSchema, type InviteValues } from "@/lib/schemas";
import { mapEmailSendError } from "@/lib/auth/email-errors";
import { checkUserDeletable } from "@/lib/user-delete-guard";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Invite a STAFF user (admin/team) via the Auth admin API (service role). role +
 * full_name go into invite metadata, which the handle_new_user trigger reads to
 * create the profiles row. A matching invitations row is recorded. Admin only.
 * Client portal users are NOT invited here — they're provisioned by
 * createClientAction (the "create client account" flow).
 */
export async function sendInviteAction(
  input: InviteValues,
): Promise<Result> {
  const admin = await requireRole(["admin"]);
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  // Staff invites are never client-scoped; clients are provisioned, not invited.
  const clientId = null;

  const adminClient = createAdminClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await adminClient.auth.admin.inviteUserByEmail(v.email, {
    data: {
      role: v.role,
      client_id: clientId,
      full_name: v.full_name ?? null,
    },
    // Identical to password-reset: route through the prefetch-safe /auth/confirm
    // interstitial (token verified on a human POST, not a GET) so an email-scanner
    // can't burn the one-time invite token. The invite email template must use the
    // token_hash → /auth/confirm form (type=invite, next=/accept-invite).
    redirectTo: `${siteUrl}/auth/confirm?next=/accept-invite`,
  });

  if (error) {
    const status = (error as { status?: number }).status;
    // raw error → server logs + audit trail (failures previously left no trace)
    console.error("inviteUserByEmail failed:", {
      email: v.email,
      role: v.role,
      status,
      message: error.message,
    });
    await logAudit({
      actorId: admin.id,
      action: "user.invite_failed",
      entity: "invitation",
      clientId,
      metadata: {
        email: v.email,
        role: v.role,
        status: status ?? null,
        error: error.message,
      },
    });
    return {
      ok: false,
      error: mapEmailSendError(error.message, status, { adminViewer: true }),
    };
  }

  // record the invitation (RLS: admin only — server client as admin works)
  const supabase = await createClient();
  await supabase.from("invitations").insert({
    email: v.email,
    role: v.role,
    client_id: clientId,
    invited_by: admin.id,
  });

  await logAudit({
    actorId: admin.id,
    action: "user.invited",
    entity: "invitation",
    clientId,
    metadata: { email: v.email, role: v.role },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Resend a stuck invite (user invited but never accepted). The Auth admin API
 * has no direct "resend", so we delete the unaccepted user and re-invite with
 * the same metadata. Guarded to pending (unconfirmed) users only. Admin only.
 */
export async function resendInviteAction(userId: string): Promise<Result> {
  const me = await requireRole(["admin"]);
  const adminClient = createAdminClient();

  const { data: got } = await adminClient.auth.admin.getUserById(userId);
  if (!got?.user) return { ok: false, error: "User not found." };
  if (got.user.email_confirmed_at) {
    return { ok: false, error: "This user already accepted their invite." };
  }

  const supabase = await createClient();
  const { data: prof } = await supabase
    .from("profiles")
    .select("email, role, client_id, full_name")
    .eq("id", userId)
    .single();
  const email = prof?.email ?? got.user.email;
  if (!email) return { ok: false, error: "No email on file for this user." };

  // capture metadata, then delete + re-invite (cascades the old profile row)
  const role = prof?.role ?? "client";
  const clientId = prof?.client_id ?? null;
  await adminClient.auth.admin.deleteUser(userId);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { role, client_id: clientId, full_name: prof?.full_name ?? null },
    // route through the prefetch-safe /auth/confirm interstitial, like the other
    // invite actions (the custom token_hash template drives the link, but keep this
    // consistent so it's correct if the template ever switches to .ConfirmationURL).
    redirectTo: `${siteUrl}/auth/confirm?next=/accept-invite`,
  });
  if (error) {
    const status = (error as { status?: number }).status;
    console.error("resendInvite failed:", { email, status, message: error.message });
    await logAudit({
      actorId: me.id,
      action: "user.invite_failed",
      entity: "invitation",
      clientId,
      metadata: { email, resend: true, status: status ?? null, error: error.message },
    });
    return { ok: false, error: mapEmailSendError(error.message, status, { adminViewer: true }) };
  }

  await supabase.from("invitations").insert({
    email,
    role,
    client_id: clientId,
    invited_by: me.id,
  });
  await logAudit({
    actorId: me.id,
    action: "user.invite_resent",
    entity: "invitation",
    clientId,
    metadata: { email, role },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Revoke a pending invite — deletes the unaccepted auth user. Admin only. */
export async function revokeInviteAction(userId: string): Promise<Result> {
  const me = await requireRole(["admin"]);
  if (userId === me.id) return { ok: false, error: "You can't revoke your own account." };
  const adminClient = createAdminClient();

  const { data: got } = await adminClient.auth.admin.getUserById(userId);
  if (!got?.user) return { ok: false, error: "User not found." };
  if (got.user.email_confirmed_at) {
    return { ok: false, error: "This user already accepted — deactivate instead of revoke." };
  }

  const email = got.user.email;
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "user.invite_revoked",
    entity: "profile",
    entityId: userId,
    metadata: { email },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * HARD-delete a user (irreversible). Deactivate is the gentle default; this
 * permanently removes the auth user via the service role, which cascades the
 * profile + their personal state (notifications, prefs, thread_reads,
 * assignments). Everything they AUTHORED survives un-attributed ("Removed user"
 * — created_by/author_id/uploaded_by/assignee_id are SET NULL), and the audit
 * trail is preserved (actor_id SET NULL). Admin only. Guards (the system can't be
 * locked out): no self-delete, no deleting the last ACTIVE admin — enforced by the
 * pure checkUserDeletable. The UI gates this behind a type-the-name confirm dialog.
 */
export async function deleteUserAction(userId: string): Promise<Result> {
  const me = await requireRole(["admin"]);
  const adminClient = createAdminClient();
  const supabase = await createClient();

  const { data: got } = await adminClient.auth.admin.getUserById(userId);
  if (!got?.user) return { ok: false, error: "User not found." };

  const { data: target } = await supabase
    .from("profiles")
    .select("role, email, full_name, is_active")
    .eq("id", userId)
    .single();
  if (!target) return { ok: false, error: "User not found." };

  // count currently-active admins (includes the target if they're an active admin)
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);

  const guard = checkUserDeletable({
    targetId: userId,
    callerId: me.id,
    targetRole: target.role,
    targetActive: target.is_active,
    activeAdminCount: count ?? 0,
  });
  if (!guard.ok) return { ok: false, error: guard.error };

  // audit BEFORE the delete — capture the vanishing identity; the row survives
  // (actor_id = me/admin; entity_id is plain text with no FK).
  await logAudit({
    actorId: me.id,
    action: "user.deleted",
    entity: "profile",
    entityId: userId,
    metadata: { email: target.email, full_name: target.full_name, role: target.role },
  });

  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Deactivate / reactivate a user (profiles.is_active). Deactivated users are
 * blocked at the auth gate on their next request (requireProfile signs them out
 * and redirects to /login). Admin only; admins can't deactivate themselves.
 */
export async function setUserActiveAction(
  userId: string,
  isActive: boolean,
): Promise<Result> {
  const admin = await requireRole(["admin"]);
  if (userId === admin.id && !isActive) {
    return { ok: false, error: "You can't deactivate your own account." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: admin.id,
    action: isActive ? "user.reactivated" : "user.deactivated",
    entity: "profile",
    entityId: userId,
    metadata: { is_active: isActive },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/** Assign a team member to a client. Admin only; target must be role=team. */
export async function assignUserAction(
  clientId: string,
  userId: string,
): Promise<Result> {
  const admin = await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!target || target.role !== "team") {
    return { ok: false, error: "Only team members can be assigned to clients." };
  }

  const { error } = await supabase
    .from("client_assignments")
    .upsert(
      { client_id: clientId, user_id: userId, assigned_by: admin.id },
      { onConflict: "client_id,user_id" },
    );
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: admin.id,
    action: "assignment.created",
    entity: "client_assignment",
    entityId: userId,
    clientId,
    metadata: { user_id: userId },
  });

  revalidatePath(`/clients/${clientId}/settings`);
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Unassign a team member from a client. Admin only. */
export async function unassignUserAction(
  clientId: string,
  userId: string,
): Promise<Result> {
  const admin = await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_assignments")
    .delete()
    .eq("client_id", clientId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: admin.id,
    action: "assignment.removed",
    entity: "client_assignment",
    entityId: userId,
    clientId,
    metadata: { user_id: userId },
  });

  revalidatePath(`/clients/${clientId}/settings`);
  revalidatePath("/admin/users");
  return { ok: true };
}
