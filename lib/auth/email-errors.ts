/**
 * Map a Supabase/SMTP email-send error to a specific, human, non-sensitive
 * message. Supabase often returns a generic "Error sending invite email" and
 * hides the real SMTP cause in its Auth logs / the provider's logs — so the
 * generic case maps to an actionable "where to look" message. The raw error is
 * always logged server-side and written to audit_log; only this mapped string
 * is shown in the UI.
 *
 * adminViewer: true surfaces a sanitized raw tail in the fallback (the invite
 * flow is admin-only); false keeps it generic for the public reset page.
 */
export function mapEmailSendError(
  message: string | undefined,
  status: number | undefined,
  opts: { adminViewer?: boolean } = {},
): string {
  const m = (message ?? "").toLowerCase();

  if (/already.*(registered|exists)|email.*already/.test(m)) {
    return "That email is already registered.";
  }
  if (status === 429 || /rate.?limit|too many|exceeded/.test(m)) {
    return "Email rate limit hit — wait a few minutes, or raise the limits in Supabase → Authentication → Rate Limits.";
  }
  if (/not\s*verif|domain.*verif|unverified|sender.*not/.test(m)) {
    return "Sender domain not verified in Resend — verify mail.fourpielabs.com (and that the API key is from that Resend account).";
  }
  if (/smtp|authentication|invalid login|535|auth failed|bad credentials|unauthorized|401/.test(m)) {
    return "SMTP authentication failed — check the Resend API key in Supabase → Authentication → SMTP Settings.";
  }
  if (/invalid.*email|email.*invalid|bad.*email/.test(m)) {
    return "That email address looks invalid.";
  }
  if (/sending.*email|email.*(send|sending)|failed.*email|relay|connection refused|timeout|tls|econn/.test(m)) {
    return "Email send failed (SMTP). Check Resend → Emails and Supabase → Authentication → Logs for the exact cause (SMTP auth, unverified sender domain, or rate limit).";
  }

  if (opts.adminViewer && message) {
    const safe = message.replace(/\s+/g, " ").trim().slice(0, 140);
    return `Email send failed: ${safe}`;
  }
  return "Couldn't send the email right now. Please try again shortly.";
}
