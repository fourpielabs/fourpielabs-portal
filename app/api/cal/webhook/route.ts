import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, clientUserIds, staffUserIds } from "@/lib/notifications";

/**
 * Cal.com booking webhook (booking sync, Part A).
 *
 * Cal.com POSTs BOOKING_CREATED / BOOKING_RESCHEDULED / BOOKING_CANCELLED events
 * here. We verify the signature, then upsert into call_bookings keyed on the
 * Cal.com booking uid (external_id) — IDEMPOTENT, because Cal.com retries
 * deliveries. All writes go through the SERVICE-ROLE client (bypasses RLS); there
 * is NO client write path to call_bookings (clients only ever SELECT).
 *
 * Signature: Cal.com signs an HMAC-SHA256 of the RAW request body (hex), sent in
 * the `x-cal-signature-256` header. We read the raw body for verification AND
 * parsing — never re-serialize, since JSON.stringify can differ byte-for-byte from
 * what Cal.com signed.
 */

// node:crypto + the service-role key → must run on the Node runtime, never edge.
export const runtime = "nodejs";

type CalAttendee = { name?: string | null; email?: string | null };
type CalPayload = {
  uid?: string;
  bookingId?: number | string;
  title?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  attendees?: CalAttendee[];
  organizer?: { name?: string | null; email?: string | null };
  location?: string | null;
  videoCallData?: { url?: string | null } | null;
  metadata?: Record<string, unknown> | null;
  responses?: Record<string, unknown> | null;
};
type CalEvent = { triggerEvent?: string; createdAt?: string; payload?: CalPayload };

const STATUS_BY_EVENT: Record<string, "booked" | "rescheduled" | "cancelled"> = {
  BOOKING_CREATED: "booked",
  BOOKING_RESCHEDULED: "rescheduled",
  BOOKING_CANCELLED: "cancelled",
};

/** Constant-time HMAC-SHA256 (hex) compare of the raw body against the header. */
function verifySignature(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(header.trim().toLowerCase(), "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** First non-empty string/number value among the given metadata keys. */
function metaString(
  meta: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  if (!meta) return null;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** Best-effort meeting link: Cal video data → metadata → a URL-shaped location. */
function meetingUrl(p: CalPayload): string | null {
  if (p.videoCallData?.url) return p.videoCallData.url;
  const metaUrl = metaString(p.metadata, "videoCallUrl");
  if (metaUrl) return metaUrl;
  if (p.location && /^https?:\/\//i.test(p.location)) return p.location;
  return null;
}

export async function POST(req: Request) {
  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) {
    // a deploy misconfiguration — surface it (don't silently accept unsigned data)
    console.error("cal webhook: CAL_WEBHOOK_SECRET is not set — rejecting");
    return new Response("not configured", { status: 500 });
  }

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-cal-signature-256"), secret)) {
    return new Response("invalid signature", { status: 401 });
  }

  let event: CalEvent;
  try {
    event = JSON.parse(raw) as CalEvent;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const status = STATUS_BY_EVENT[event.triggerEvent ?? ""];
  if (!status) {
    // not a booking-lifecycle event we sync — ack so Cal.com stops retrying
    return new Response("ignored", { status: 200 });
  }

  const p = event.payload ?? {};
  const externalId = p.uid ?? (p.bookingId != null ? String(p.bookingId) : null);
  if (!externalId) {
    console.error("cal webhook: missing booking uid", event.triggerEvent);
    return new Response("ok (no uid)", { status: 200 }); // unrecoverable → don't loop
  }

  const admin = createAdminClient();

  // ---- resolve client_id RELIABLY ------------------------------------------
  // Primary: Part B's embed passes the portal client_id (+ call_type_id) in the
  // Cal.com booking metadata. We still validate the id exists (never trust input).
  let clientId = metaString(p.metadata, "clientId", "client_id", "portalClientId");
  let callTypeId = metaString(p.metadata, "callTypeId", "call_type_id");

  if (clientId) {
    const { data } = await admin.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (!data) clientId = null;
  }
  // Fallback: match an attendee email to a client portal user → their client_id.
  if (!clientId) {
    const emails = (p.attendees ?? [])
      .map((a) => a.email)
      .filter((e): e is string => !!e);
    if (emails.length) {
      const { data } = await admin
        .from("profiles")
        .select("client_id")
        .in("email", emails)
        .not("client_id", "is", null)
        .limit(1)
        .maybeSingle();
      if (data?.client_id) clientId = data.client_id as string;
    }
  }
  if (!clientId) {
    // unmappable → log + ack (NEVER 500-loop Cal.com); flag for manual review.
    console.error("cal webhook: could not resolve client_id — flagged for review", {
      trigger: event.triggerEvent,
      externalId,
      attendees: (p.attendees ?? []).map((a) => a.email),
    });
    return new Response("ok (unmapped — flagged for review)", { status: 200 });
  }

  // only link a call_type that belongs to THIS client (RLS checks the booking's
  // client_id, not the linked type's — guard it here, the resolveProjectId pattern).
  if (callTypeId) {
    const { data } = await admin
      .from("call_types")
      .select("id")
      .eq("id", callTypeId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!data) callTypeId = null;
  }

  // ---- idempotent upsert keyed on external_id ------------------------------
  // Did this uid already exist? → only notify on a genuinely NEW booking.
  const { data: existing } = await admin
    .from("call_bookings")
    .select("id")
    .eq("external_id", externalId)
    .maybeSingle();

  const attendee = (p.attendees ?? [])[0] ?? {};
  const { error } = await admin.from("call_bookings").upsert(
    {
      client_id: clientId,
      external_id: externalId,
      call_type_id: callTypeId,
      title: p.title ?? null,
      start_at: p.startTime ?? null,
      end_at: p.endTime ?? null,
      status,
      attendee_name: attendee.name ?? null,
      attendee_email: attendee.email ?? null,
      meeting_url: meetingUrl(p),
      raw: event,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "external_id" },
  );
  if (error) {
    // transient DB error — let Cal.com retry (the upsert is idempotent, so safe).
    console.error("cal webhook: upsert failed", error.message);
    return new Response("upsert failed", { status: 500 });
  }

  // ---- notify on a genuinely NEW booking (not reschedule / cancel / retry) --
  if (event.triggerEvent === "BOOKING_CREATED" && !existing) {
    const [staff, clients] = await Promise.all([
      staffUserIds(clientId),
      clientUserIds(clientId),
    ]);
    const title = "New call booked";
    // role-appropriate deep links (the no-body email rule is enforced in notify()).
    await Promise.all([
      notify({
        recipients: staff,
        type: "call_booked",
        title,
        link: `/clients/${clientId}/calls`,
        clientId,
      }),
      notify({
        recipients: clients,
        type: "call_booked",
        title,
        link: "/calls-notes",
        clientId,
      }),
    ]);
  }

  return new Response("ok", { status: 200 });
}
