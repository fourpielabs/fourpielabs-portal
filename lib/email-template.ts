// Shared, email-client-safe template for BOTH notification emails (Resend, our
// code) and the auth emails (the same shell is regenerated into the Supabase
// invite/recovery templates). Pure — no server imports — so tests can import it.
//
// Email rules baked in here: TABLE layout (no flex/grid — Outlook = Word engine),
// INLINE css only, 600px shell, web-safe font stack, a bulletproof CTA (MSO VML
// roundrect for Outlook + a padded <a> everywhere else), explicit colors for
// dark-mode clients, alt + width/height on the logo.

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const AMBER = "#B45309"; // CTA — white text on this has strong contrast
const INK = "#1c1917";
const INK_2 = "#57534e";
const MUTED = "#a8a29e";
const BG = "#f5f4f1";
const CARD_BORDER = "#e7e5e0";

export function emailLogoUrl(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${site.replace(/\/$/, "")}/email-logo.png`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

/** Bulletproof CTA: VML roundrect for Outlook (fitted width), padded <a> elsewhere. */
function ctaButton(label: string, url: string): string {
  const w = Math.min(440, Math.max(180, label.length * 9 + 56));
  return `
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:46px;v-text-anchor:middle;width:${w}px;" arcsize="22%" stroke="f" fillcolor="${AMBER}">
    <w:anchorlock/>
    <center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;">${esc(label)}</center>
  </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-- -->
  <a href="${url}" style="display:inline-block;background:${AMBER};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;text-decoration:none;padding:13px 26px;border-radius:10px;">${esc(label)}</a>
  <!--<![endif]-->`;
}

export function renderEmail(input: {
  heading: string; // plain text — escaped here
  bodyHtml: string; // trusted HTML the caller built (no user text, or pre-escaped)
  ctaLabel: string;
  ctaUrl: string; // trusted (our link); may contain Supabase template vars for auth emails
  footerNote: string; // plain text — escaped here
  preheader?: string; // hidden inbox preview text
  logoUrl?: string; // override (auth templates use Supabase's {{ .SiteURL }}/email-logo.png)
}): string {
  const logo = input.logoUrl ?? emailLogoUrl();
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<title>4Pie Labs</title>
<!--[if mso]><style>td,a,span{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;width:100%;background:${BG};-webkit-text-size-adjust:100%;">
${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BG};">${esc(input.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;">
        <tr>
          <td align="left" style="padding:4px 4px 20px;">
            <img src="${logo}" alt="4Pie Labs" width="150" height="45" style="display:block;border:0;outline:none;text-decoration:none;height:45px;width:150px;">
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border:1px solid ${CARD_BORDER};border-radius:16px;padding:32px;">
            <h1 style="margin:0 0 12px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${INK};">${esc(input.heading)}</h1>
            <div style="font-family:${FONT};font-size:15px;line-height:1.6;color:${INK_2};">${input.bodyHtml}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;"><tr><td>${ctaButton(input.ctaLabel, input.ctaUrl)}</td></tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
            <p style="margin:0 0 4px;">${esc(input.footerNote)}</p>
            <p style="margin:0;">Sent by 4Pie&nbsp;Labs · <a href="mailto:team@fourpielabs.com" style="color:${MUTED};text-decoration:underline;">team@fourpielabs.com</a></p>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}
