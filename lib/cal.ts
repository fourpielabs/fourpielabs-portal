/**
 * call_types.booking_url convention (Cal.com booking — Part B).
 *
 * Going forward, booking_url carries a Cal.com **calLink** in `username/event-slug`
 * form (e.g. `four-pie-labs/client-call`, or a team link `team/<slug>/<event>`).
 * Only that scheme-less slug form opens the in-portal Cal.com popup.
 *
 * A full `http(s)://…` URL is treated as LEGACY (e.g. the old Calendly links in the
 * seed) and opens in a new tab — the embed is never used for it. This keeps old data
 * working: nothing with a scheme is ever fed to the popup.
 */
export function isCalLink(bookingUrl: string | null | undefined): bookingUrl is string {
  if (!bookingUrl) return false;
  const v = bookingUrl.trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v)) return false; // full URL → legacy external link
  if (v.startsWith("/")) return false; // not a bare slug
  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+$/.test(v); // username/event-slug (or team/…/…)
}
