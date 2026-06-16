import { appendFileSync } from "node:fs";

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

/**
 * Build a notification email — CONTENT-LEAKAGE rule: there is NO `body` parameter, so the
 * message text (or any sensitive body) can never leave the portal. The email carries only
 * the safe `title` (sender / event name), the client context, and a link back to the portal.
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

  const html = `<!doctype html><html><body style="margin:0;background:#faf9f7;font-family:Inter,Arial,sans-serif;color:#1c1917">
  <div style="max-width:480px;margin:0 auto;padding:28px 20px">
    <div style="padding-bottom:18px">${emailBrand()}</div>
    <div style="background:#ffffff;border:1px solid #e7e5e0;border-radius:16px;padding:24px">
      <p style="margin:0 0 6px;font-size:16px;font-weight:600">${escapeHtml(input.title)}</p>
      ${input.clientName ? `<p style="margin:0 0 16px;font-size:13px;color:#78716c">on ${escapeHtml(input.clientName)}</p>` : ""}
      <p style="margin:0 0 20px;font-size:14px;color:#57534e">Open it in your 4Pie Labs portal.</p>
      <a href="${url}" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px">View in portal</a>
    </div>
    <p style="margin:18px 0 0;font-size:11px;color:#a8a29e">You're receiving this because you have a 4Pie Labs portal account.</p>
  </div></body></html>`;

  const text = `${input.title}${input.clientName ? ` · ${input.clientName}` : ""}\n\nOpen it in your 4Pie Labs portal:\n${url}`;
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
