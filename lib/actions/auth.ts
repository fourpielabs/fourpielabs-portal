"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { mapEmailSendError } from "@/lib/auth/email-errors";

type Result = { ok: true } | { ok: false; error: string };

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
