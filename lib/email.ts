import { appendFileSync } from "node:fs";
import { renderEmail } from "./email-template";

// from = the auth-mail domain (approved). reply-to routes client replies to the team
// (otherwise a reply goes into a void). NOTE: AUTH emails (invite/recovery) are sent by
// Supabase's own mailer, NOT this code — their reply-to is a separate config item (see LAUNCH.md).
const RESEND_FROM = process.env.RESEND_FROM ?? "4Pie Labs <noreply@mail.fourpielabs.com>";
const REPLY_TO = "team@fourpielabs.com";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

/**
 * Single source for the email brand header — mirrors components/ui/brand-logo.tsx's
 * text-wordmark placeholder (React/Tailwind don't apply in email HTML). When the real
 * logo asset lands, swap the markup here + in BrandLogo (the logged launch blocker).
 */
export function emailBrand(): string {
  return `<span style="font-family:Inter,Arial,sans-serif;font-weight:700;font-size:18px;color:#1c1917">4Pie&nbsp;Labs<span style="color:#d97706">.</span></span>`;
}

// Per-type CTA label (the look only — still NO message body in the email).
const CTA_BY_TYPE: Record<string, string> = {
  message: "Open the conversation",
  deliverable_delivered: "View deliverable",
  deliverable_approved: "View deliverable",
  report_published: "View report",
  project_status: "View project",
  call_booked: "View booking",
};

/**
 * Build a notification email — CONTENT-LEAKAGE rule: there is NO `body` parameter, so the
 * message text (or any sensitive body) can never leave the portal. The email carries only
 * the safe `title` (sender / event name), the client context, and a link back to the portal.
 * The branded shell comes from the shared renderEmail() (real logo, amber CTA, table layout).
 */
export function buildNotificationEmail(input: {
  type: string;
  title: string;
  clientName?: string | null;
  link: string;
}): { subject: string; html: string; text: string } {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = input.link.startsWith("http") ? input.link : `${site}${input.link}`;
  const subject = input.clientName ? `${input.title} · ${input.clientName}` : input.title;
  const ctaLabel = CTA_BY_TYPE[input.type] ?? "Open in portal";

  // bodyHtml carries NO message text — only the safe client context + a nudge.
  const bodyHtml = `${input.clientName ? `<p style="margin:0 0 14px;">on <strong style="color:#1c1917;">${escapeHtml(input.clientName)}</strong></p>` : ""}<p style="margin:0;">Open it in your 4Pie&nbsp;Labs portal to see the details.</p>`;

  const html = renderEmail({
    heading: input.title,
    bodyHtml,
    ctaLabel,
    ctaUrl: url,
    footerNote: "You're receiving this because you have a 4Pie Labs portal account.",
    preheader: input.title,
  });

  const text = `${input.title}${input.clientName ? ` · ${input.clientName}` : ""}\n\nOpen it in your 4Pie Labs portal:\n${url}\n\n— 4Pie Labs`;
  return { subject, html, text };
}

/**
 * Send one notification email via the Resend HTTP API (no SMTP, no package — fetch).
 *   - EMAIL_CAPTURE=1 → record to EMAIL_CAPTURE_FILE instead of sending (tests).
 *   - no RESEND_API_KEY → logged no-op (the app never breaks).
 * Failures are swallowed + logged — email must never break the user's action.
 */
export async function sendNotificationEmail(
  to: string,
  email: { subject: string; html: string; text: string },
  meta?: { type?: string },
): Promise<void> {
  if (process.env.EMAIL_CAPTURE === "1" && process.env.EMAIL_CAPTURE_FILE) {
    try {
      appendFileSync(
        process.env.EMAIL_CAPTURE_FILE,
        JSON.stringify({ to, subject: email.subject, html: email.html, type: meta?.type ?? null }) + "\n",
      );
    } catch {
      /* ignore capture errors */
    }
    return;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("email skipped (no RESEND_API_KEY):", email.subject, "→", to);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM,
        to,
        reply_to: REPLY_TO,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    if (!res.ok) console.error("Resend send failed:", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("Resend send error:", (e as Error).message);
  }
}
