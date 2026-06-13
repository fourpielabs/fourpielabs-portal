"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";

type Result = { ok: true } | { ok: false; error: string };

const schema = z.object({
  full_name: z.string().trim().min(1, "Enter your name").max(100, "Too long"),
});

/**
 * Self-service profile update (own row only). RLS `profiles_update_own` allows
 * the user's own session to update their row; the `enforce_profile_self_update`
 * trigger blocks role/client_id/is_active, so only `full_name` is written here.
 */
export async function updateOwnProfileAction(input: {
  full_name: string;
}): Promise<Result> {
  const me = await requireProfile();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("id", me.id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "profile.updated",
    entity: "profile",
    entityId: me.id,
    metadata: { full_name: parsed.data.full_name },
  });

  revalidatePath("/settings");
  return { ok: true };
}
