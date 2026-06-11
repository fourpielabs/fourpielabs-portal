"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { inviteSchema, type InviteValues } from "@/lib/schemas";
import { mapEmailSendError } from "@/lib/auth/email-errors";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Invite a user via the Auth admin API (service role). role + client_id +
 * full_name go into invite metadata, which the handle_new_user trigger reads
 * to create the profiles row. A matching invitations row is recorded. Admin only.
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
  const clientId = v.role === "client" ? (v.client_id as string) : null;

  const adminClient = createAdminClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await adminClient.auth.admin.inviteUserByEmail(v.email, {
    data: {
      role: v.role,
      client_id: clientId,
      full_name: v.full_name ?? null,
    },
    redirectTo: `${siteUrl}/accept-invite`,
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
