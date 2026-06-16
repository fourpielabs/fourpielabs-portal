import { createAdminClient } from "@/lib/supabase/admin";
import { buildNotificationEmail, sendNotificationEmail } from "@/lib/email";
import { emailPrefColumn } from "@/lib/notification-prefs";

export type NotificationType =
  | "message"
  | "deliverable_delivered"
  | "deliverable_approved"
  | "report_published"
  | "project_status";

const EMAIL_THROTTLE_MS = 5 * 60 * 1000; // 1 message email per recipient/thread / 5 min
const ACTIVE_VIEW_MS = 2 * 60 * 1000; // skip if the recipient viewed the thread < 2 min ago

/**
 * Gate for the EMAIL channel only (the in-app row always inserts). Messages are
 * rate-limited (leading-edge: a prior message notification on the same thread-link
 * within the window suppresses the email) and skipped if the recipient is actively
 * in the thread. Non-message events always email.
 */
async function shouldEmail(
  admin: ReturnType<typeof createAdminClient>,
  recipientId: string,
  input: { type: string; link?: string | null; threadId?: string | null },
): Promise<boolean> {
  if (input.type !== "message") return true;
  if (input.link) {
    const since = new Date(Date.now() - EMAIL_THROTTLE_MS).toISOString();
    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", recipientId)
      .eq("type", "message")
      .eq("link", input.link)
      .gte("created_at", since);
    if ((count ?? 0) > 0) return false; // already nudged this thread in the window
  }
  if (input.threadId) {
    const { data: tr } = await admin
      .from("thread_reads")
      .select("last_read_at")
      .eq("thread_id", input.threadId)
      .eq("user_id", recipientId)
      .maybeSingle();
    if (tr?.last_read_at && Date.now() - new Date(tr.last_read_at).getTime() < ACTIVE_VIEW_MS) {
      return false; // actively viewing — the bell covers it
    }
  }
  return true;
}

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
  clientId?: string | null; // for the email's "on {client}" context
  threadId?: string | null; // for the message active-view skip
}): Promise<void> {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const uid of input.recipients) {
    if (!uid || uid === input.excludeUserId || seen.has(uid)) continue;
    seen.add(uid);
    ids.push(uid);
  }
  if (ids.length === 0) return;
  const admin = createAdminClient();

  // EMAIL gate — computed BEFORE the insert so the throttle counts only PRIOR rows.
  const emailIds: string[] = [];
  for (const rid of ids) {
    if (await shouldEmail(admin, rid, input)) emailIds.push(rid);
  }

  // in-app rows ALWAYS insert (the bell updates every time; only EMAIL is gated)
  const { error } = await admin
    .from("notifications")
    .insert(ids.map((uid) => ({
      user_id: uid,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    })));
  if (error) console.error("notifications insert failed:", error.message, input.type);

  // EMAIL the gated recipients (Resend; CONTENT-LEAKAGE: no body in email). The
  // recipient list is the SAME as the in-app one, so the internal-thread boundary
  // (client never in the internal recipient set) holds in email too.
  if (emailIds.length > 0) {
    // 4e EMAIL-ONLY preference gate: a recipient whose per-type column is FALSE opts
    // out of this email. **No row → SEND** (the opt-out default — a missing pref must
    // never silently skip). The in-app rows above are unaffected by preferences.
    let sendIds = emailIds;
    const column = emailPrefColumn(input.type);
    if (column) {
      const res = await admin
        .from("notification_preferences")
        .select(`user_id, ${column}`)
        .in("user_id", emailIds);
      const prefs = (res.data ?? []) as unknown as Array<Record<string, unknown>>;
      const optedOut = new Set(
        prefs.filter((p) => p[column] === false).map((p) => p.user_id as string),
      );
      sendIds = emailIds.filter((id) => !optedOut.has(id)); // absence-of-row stays in → sends
    }
    if (sendIds.length === 0) return;

    const [{ data: profs }, clientName] = await Promise.all([
      admin.from("profiles").select("id, email").in("id", sendIds).eq("is_active", true),
      input.clientId
        ? admin.from("clients").select("name").eq("id", input.clientId).maybeSingle().then((r) => r.data?.name ?? null)
        : Promise.resolve(null),
    ]);
    const built = buildNotificationEmail({
      type: input.type,
      title: input.title,
      clientName,
      link: input.link ?? "/dashboard",
    });
    await Promise.all(
      (profs ?? [])
        .filter((p) => p.email)
        .map((p) => sendNotificationEmail(p.email as string, built, { type: input.type })),
    );
  }
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
