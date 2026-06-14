"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";

type Result = { ok: true } | { ok: false; error: string };

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

// Validate genuine image content by magic bytes (not extension/MIME header).
function detectImage(buf: Buffer): { type: string } | null {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return { type: "image/png" };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { type: "image/jpeg" };
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38)
    return { type: "image/gif" };
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return { type: "image/webp" };
  return null;
}

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

/**
 * Avatar upload — service-role write to the public `avatars` bucket at a FIXED
 * path per user (overwrite, no orphans). Validates real image content by magic
 * bytes + caps size. avatar_url is then written via the user's own session
 * (permitted by profiles_update_own; not blocked by the guard trigger).
 */
export async function uploadAvatarAction(
  form: FormData,
): Promise<Result & { url?: string }> {
  const me = await requireProfile();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected" };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Image must be 2 MB or smaller" };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = detectImage(buf);
  if (!kind) {
    return { ok: false, error: "That doesn't look like a PNG, JPG, GIF, or WebP image" };
  }

  const admin = createAdminClient();
  const path = me.id; // fixed path per user — overwrite on re-upload
  const up = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(path, buf, { contentType: kind.type, upsert: true });
  if (up.error) return { ok: false, error: up.error.message };

  const { data: pub } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${buf.length}-${file.lastModified}`; // cache-bust

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", me.id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "profile.avatar_updated",
    entity: "profile",
    entityId: me.id,
  });
  revalidatePath("/settings");
  return { ok: true, url };
}

export async function removeAvatarAction(): Promise<Result> {
  const me = await requireProfile();
  const admin = createAdminClient();
  await admin.storage.from(AVATAR_BUCKET).remove([me.id]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", me.id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "profile.avatar_updated",
    entity: "profile",
    entityId: me.id,
    metadata: { removed: true },
  });
  revalidatePath("/settings");
  return { ok: true };
}
