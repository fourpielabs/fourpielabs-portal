"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { mapEmailSendError } from "@/lib/auth/email-errors";

type Result = { ok: true } | { ok: false; error: string };

const ALLOWED_TYPES: EmailOtpType[] = ["invite", "recovery", "email"];

/**
 * Verify an email OTP (token_hash) and establish the session. Invoked by a POST
 * from the /auth/confirm interstitial (a human button click) — never on a bare
 * GET — so email-scanner prefetches can't burn the one-time token. On success,
 * redirects to a RELATIVE `next`; on failure, back to /login.
 */
export async function verifyEmailOtpAction(formData: FormData): Promise<void> {
  const token_hash = String(formData.get("token_hash") ?? "");
  const rawType = String(formData.get("type") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");
  const type = ALLOWED_TYPES.includes(rawType as EmailOtpType)
    ? (rawType as EmailOtpType)
    : null;

  if (!token_hash || !type) redirect("/login?error=link");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    console.error("verifyOtp failed:", { type, message: error.message });
    redirect("/login?error=link");
  }

  // invite + recovery are password-SETTING flows: ALWAYS land on the set-password
  // form, regardless of the `next` the email link carried. This makes the
  // "invited user lands on /dashboard with no password" symptom structurally
  // impossible — even from a stale/misconfigured invite email still in an inbox.
  // `next` (relative-only, open-redirect guarded) is honored for other types.
  const dest =
    type === "invite" || type === "recovery"
      ? "/accept-invite"
      : next.startsWith("/")
        ? next
        : "/dashboard";
  redirect(dest);
}

const schema = z.object({ email: z.string().trim().email("Enter a valid email") });

/**
 * Send a password-reset email. Same observability treatment as invites: the raw
 * error is logged server-side and written to audit_log (password_reset.failed),
 * and a mapped, non-sensitive message is returned for the UI. Public page, so
 * the mapped message stays generic (adminViewer: false).
 */
export async function sendPasswordResetAction(email: string): Promise<Result> {
  const parsed = schema.safeParse({ email });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }
  const addr = parsed.data.email;
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(addr, {
    redirectTo: `${siteUrl}/auth/confirm?next=/accept-invite`,
  });

  if (error) {
    const status = (error as { status?: number }).status;
    console.error("resetPasswordForEmail failed:", {
      email: addr,
      status,
      message: error.message,
    });
    await logAudit({
      actorId: null,
      action: "password_reset.failed",
      entity: "auth",
      metadata: { email: addr, status: status ?? null, error: error.message },
    });
    return { ok: false, error: mapEmailSendError(error.message, status) };
  }

  await logAudit({
    actorId: null,
    action: "password_reset.requested",
    entity: "auth",
    metadata: { email: addr },
  });
  return { ok: true };
}
