import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationType =
  | "message"
  | "deliverable_delivered"
  | "deliverable_approved"
  | "report_published"
  | "project_status";

/**
 * Insert notification rows through the SERVICE-ROLE client (mirrors lib/audit.ts).
 * notifications has no INSERT policy, so event-generated rows must bypass RLS via
 * the service role. One row per recipient. The author is ALWAYS excluded and the
 * recipient list is de-duped — structurally, so no caller can self-notify or
 * double-notify a user (covers the admin-is-author-and-staff-recipient case).
 */
export async function notify(input: {
  recipients: string[];
  excludeUserId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  for (const uid of input.recipients) {
    if (!uid || uid === input.excludeUserId || seen.has(uid)) continue;
    seen.add(uid);
    rows.push({
      user_id: uid,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
  }
  if (rows.length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert(rows);
  // Notification failures must never break the user's action; surface in logs.
  if (error) console.error("notifications insert failed:", error.message, input.type);
}

/** Active client-portal users of a client (the client contacts). */
export async function clientUserIds(clientId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("client_id", clientId)
    .eq("is_active", true);
  return (data ?? []).map((p) => p.id as string);
}

/** Staff for a client: assigned (active) team members ∪ all active admins. */
export async function staffUserIds(clientId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: assigns } = await admin
    .from("client_assignments")
    .select("user_id")
    .eq("client_id", clientId);
  const assignedIds = (assigns ?? []).map((a) => a.user_id as string);

  const ids = new Set<string>();
  if (assignedIds.length) {
    const { data: team } = await admin
      .from("profiles")
      .select("id")
      .in("id", assignedIds)
      .eq("is_active", true);
    for (const t of team ?? []) ids.add(t.id as string);
  }
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);
  for (const a of admins ?? []) ids.add(a.id as string);
  return [...ids];
}
