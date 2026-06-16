// The Supabase AUTH email templates (invite + recovery), generated from the SAME
// shared shell as the notification emails. These are NOT sent by app code — they're
// PATCHed into the Supabase auth config (Management API) and Supabase's mailer sends
// them, substituting {{ .SiteURL }} / {{ .TokenHash }} at send time. Keeping them in
// one place (rendered via renderEmail) means auth + notification emails stay visually
// identical. The link is unchanged from the working flow:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…&next=/accept-invite
import { renderEmail } from "./email-template";

const SITE = "{{ .SiteURL }}";
const LOGO = `${SITE}/email-logo.png`;

export function inviteTemplate(): { subject: string; html: string } {
  return {
    subject: "You're invited to your 4Pie Labs portal",
    html: renderEmail({
      heading: "Welcome to 4Pie Labs",
      bodyHtml: `<p style="margin:0;">Your client portal is ready. Set your password below and jump in — it only takes a minute.</p>`,
      ctaLabel: "Set up my portal",
      ctaUrl: `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/accept-invite`,
      footerNote: "If you didn't expect this invitation, you can safely ignore this email.",
      preheader: "Set your password and access your 4Pie Labs portal.",
      logoUrl: LOGO,
    }),
  };
}

export function recoveryTemplate(): { subject: string; html: string } {
  return {
    subject: "Reset your 4Pie Labs password",
    html: renderEmail({
      heading: "Reset your password",
      bodyHtml: `<p style="margin:0;">Click below to choose a new password for your 4Pie Labs portal.</p>`,
      ctaLabel: "Choose a new password",
      ctaUrl: `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/accept-invite`,
      footerNote: "Didn't request a password reset? You can safely ignore this email.",
      preheader: "Choose a new password for your 4Pie Labs portal.",
      logoUrl: LOGO,
    }),
  };
}
