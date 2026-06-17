// Dev-only local test for the Cal.com booking webhook (booking sync, Part A). Never ships.
// Start the SERVER first — it must have CAL_WEBHOOK_SECRET set (it's in .env.local):
//   npm run build && npx next start -p 3100
//   node scripts/verify-cal-webhook.mjs           (override with VERIFY_BASE=http://localhost:3000)
//
// Proves: a SIGNED BOOKING_CREATED upserts a call_bookings row mapped to the portal
// client_id FROM METADATA; an INVALID signature is 401; RESCHEDULED/CANCELLED update the
// SAME row idempotently (keyed on the Cal.com uid); and an UNMAPPABLE booking is acked 200
// WITHOUT creating a row (no 500-loop; flagged for review).
import { config } from "dotenv";
config({ path: ".env.local" });
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.VERIFY_BASE || "http://localhost:3100";
const SECRET = process.env.CAL_WEBHOOK_SECRET;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

if (!SECRET) { console.error("CAL_WEBHOOK_SECRET not set in .env.local — cannot sign test payloads."); process.exit(1); }

const sign = (raw) => createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
async function post(event, { sig } = {}) {
  const raw = JSON.stringify(event);
  const res = await fetch(`${BASE}/api/cal/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-cal-signature-256": sig ?? sign(raw) },
    body: raw,
  });
  return res.status;
}

const { data: premier } = await admin.from("clients").select("id").eq("slug", "premier-painting").single();
const premierId = premier.id;
const uid = `RLSCAL-${Math.floor(Date.now() / 1000)}`;

const makeEvent = (trigger, extra = {}) => ({
  triggerEvent: trigger,
  createdAt: "2026-06-17T10:00:00.000Z",
  payload: {
    uid,
    title: "Strategy call",
    startTime: "2026-07-01T15:00:00.000Z",
    endTime: "2026-07-01T15:30:00.000Z",
    attendees: [{ name: "Pat Client", email: "pat@premier.example" }],
    organizer: { name: "4Pie Labs", email: "team@fourpielabs.com" },
    videoCallData: { url: "https://meet.example/abc" },
    metadata: { clientId: premierId },
    ...extra,
  },
});

try {
  // 1. INVALID signature → 401
  const badStatus = await post(makeEvent("BOOKING_CREATED"), { sig: "deadbeef" });
  rec("invalid signature → 401", badStatus === 401, `status=${badStatus}`);

  // 2. SIGNED BOOKING_CREATED → 200 + row upserted, client_id mapped FROM METADATA
  const createdStatus = await post(makeEvent("BOOKING_CREATED"));
  rec("signed BOOKING_CREATED → 200", createdStatus === 200, `status=${createdStatus}`);
  const { data: row } = await admin
    .from("call_bookings")
    .select("client_id, status, title, start_at, attendee_email, meeting_url")
    .eq("external_id", uid)
    .maybeSingle();
  rec("client_id mapped FROM METADATA", row?.client_id === premierId, `${row?.client_id}`);
  rec("status = booked", row?.status === "booked", `${row?.status}`);
  rec(
    "fields mapped (title/attendee/meeting_url)",
    row?.title === "Strategy call" && row?.attendee_email === "pat@premier.example" && row?.meeting_url === "https://meet.example/abc",
    `${row?.title} · ${row?.attendee_email}`,
  );

  // 3. BOOKING_RESCHEDULED same uid → idempotent (still 1 row) + status rescheduled
  await post(makeEvent("BOOKING_RESCHEDULED", { startTime: "2026-07-02T16:00:00.000Z" }));
  const { data: resched, count } = await admin
    .from("call_bookings").select("status", { count: "exact" }).eq("external_id", uid);
  rec("RESCHEDULED idempotent — still 1 row (keyed on uid)", (count ?? 0) === 1, `${count} rows`);
  rec("RESCHEDULED → status rescheduled", resched?.[0]?.status === "rescheduled", `${resched?.[0]?.status}`);

  // 4. BOOKING_CANCELLED → status cancelled
  await post(makeEvent("BOOKING_CANCELLED"));
  const { data: cancelled } = await admin
    .from("call_bookings").select("status").eq("external_id", uid).maybeSingle();
  rec("CANCELLED → status cancelled", cancelled?.status === "cancelled", `${cancelled?.status}`);

  // 5. UNMAPPABLE (no metadata clientId; attendee email matches no client user) → 200, NO row
  const orphanUid = `${uid}-orphan`;
  const orphanStatus = await post(
    makeEvent("BOOKING_CREATED", { uid: orphanUid, metadata: {}, attendees: [{ name: "Nobody", email: "nobody@nowhere.example" }] }),
  );
  const { data: orphanRow } = await admin
    .from("call_bookings").select("id").eq("external_id", orphanUid).maybeSingle();
  rec("unmappable booking → 200 (no 500-loop)", orphanStatus === 200, `status=${orphanStatus}`);
  rec("unmappable booking → NO row created (flagged for review)", !orphanRow);
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  await admin.from("call_bookings").delete().like("external_id", `${uid}%`);
  // the BOOKING_CREATED fired notify() → clean the in-app rows it inserted locally
  await admin.from("notifications").delete().eq("type", "call_booked").eq("title", "New call booked");
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} Cal.com webhook checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("All Cal.com webhook checks passed. ✓");
