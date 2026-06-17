# Cal.com booking — Part B (client UI)

Client-facing booking popup + upcoming-call list, built on the **Part A** backend
(the `call_bookings` table + the signed `/api/cal/webhook` that upserts on
`external_id` and maps a booking to a client via `metadata.clientId`). This phase is
presentation + a thin booking trigger only — it does **not** touch the webhook, the
table, RLS, or auth.

## calLink vs legacy URL (the booking_url convention)

`call_types.booking_url` is interpreted by [`lib/cal.ts#isCalLink`](../../../lib/cal.ts):

| `booking_url` value                         | Treated as            | Book button does            |
| ------------------------------------------- | --------------------- | --------------------------- |
| `four-pie-labs/client-call` (scheme-less `username/event-slug`, or `team/<slug>/<event>`) | **Cal.com calLink** | opens the in-portal Cal popup |
| `https://calendly.com/…` (any `http(s)://`) | **legacy external**   | opens in a new tab (no popup) |
| empty / null                                | none                  | "Reach out to schedule."    |

Only the scheme-less slug form triggers the embed, so old Calendly data keeps working
untouched. The seed sets the demo client up with **both** (Monthly Review Call →
`four-pie-labs/client-call`; Quick Question → a Calendly URL) so both paths are live.

## Metadata (the load-bearing bit)

The Book button passes, via the Cal config, **`metadata: { clientId, callTypeId }`**
(both UUID strings) plus `name`/`email` prefill. `metadata.clientId` is exactly what
the Part A webhook reads (`payload.metadata.clientId`) to map the confirmed booking
back to the portal client — without it the booking lands unmapped. Verified locally by
reading the rendered `data-cal-config` (E2E): `clientId` == the portal client id,
`callTypeId` present, name + email present. (Confirmed against the installed
`@calcom/embed-react@1.5.3` type — the config accepts `metadata: Record<string,string>`.)

## Bundle isolation (the embed is a lazy chunk)

`@calcom/embed-react` is imported by exactly one module
([`cal-booking-button.tsx`](../../../components/booking/cal-booking-button.tsx)),
reached only through a `dynamic(() => …, { ssr:false })` edge in
[`book-button.tsx`](../../../components/booking/book-button.tsx). Proof from the build:

- The embed code lives in **one** chunk (`0w85n2b0szbjv.js`, ~1.8 KB — the npm package
  is a thin loader; the booking UI itself loads from cal.com's CDN at runtime).
- That chunk is **absent from `build-manifest.json`** (0 occurrences) → not in any
  route's first-load JS.
- Its dynamic-import registration exists in **only**
  `calls-notes/page/react-loadable-manifest.json` — no other route.
- It is **not** in the shared `main-app` / `framework` / `webpack` chunks.
- **Runtime (E2E):** `/dashboard` loads **0** cal.com requests; `/calls-notes` is the
  only route that activates the embed.

## E2E result (`scripts/shot-booking.mjs`, 9/9)

Run against `next start` with the demo client (`booking_url = four-pie-labs/client-call`):

- bundle: no cal.com embed on `/dashboard`; loads only on `/calls-notes` ✓
- `metadata.clientId` == portal client id ✓ · `callTypeId` present ✓ · name+email prefill ✓
- legacy full URL → external link (fallback) ✓
- **popup opens** over Calls & Notes (cal modal + iframe; the real "Client Call" event) ✓
- Upcoming calls shows a booked future call + Join; empty state when none ✓

**Console note:** the Cal embed logs its own benign `iframe doesn't exist —
createIframe must be called before doInIframe` on modal open (an internal iframe-load
race inside `@calcom/embed-react`, not our code; the popup works regardless). It fires
only on the booking path, never on normal navigation.

### What needs the deployed webhook
A *real* completed booking → webhook → `call_bookings` → Upcoming calls loop requires the
**deployed** `/api/cal/webhook` + `CAL_WEBHOOK_SECRET` (the webhook can't receive a
real Cal.com booking on localhost). Locally verified: the popup opens, prefills, and
**attaches `metadata.clientId`/`callTypeId`** (the part that makes the webhook map it),
and the Upcoming-calls UI renders a synced booking (inserted via service role to stand
in for a real sync).

## Screenshots
- `calls-notes-desktop.png` / `calls-notes-mobile.png` — the page (Book cards + Upcoming)
- `popup-desktop.png` / `popup-mobile.png` — the Cal popup open over Calls & Notes
- `upcoming-with-booking.png` — Upcoming calls with a synced booking + Join
- `upcoming-empty.png` — the empty state
