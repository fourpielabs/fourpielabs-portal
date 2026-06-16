"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/guards";
import { emailPrefTypesForRole } from "@/lib/notification-prefs";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Upsert the caller's email preferences. Runs on the user's session — the
 * insert_own / update_own RLS scopes the row to `auth.uid()`, so a user can only
 * write their OWN row (and seeds it on first save). Only columns this role can
 * actually receive are written (defense; the UI only shows those).
 */
export async function updateEmailPreferencesAction(
  values: Record<string, boolean>,
): Promise<Result> {
  const me = await requireProfile();
  const allowed = new Set(emailPrefTypesForRole(me.role).map((t) => t.column));
  const row: Record<string, unknown> = { user_id: me.id };
  for (const [k, v] of Object.entries(values)) {
    if (allowed.has(k)) row[k] = Boolean(v);
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(row, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
