"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/guards";
import type { NotificationType } from "@/lib/notifications";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/** The caller's recent notifications + total unread count (RLS = own rows only). */
export async function getNotificationsAction(): Promise<{
  unread: number;
  items: NotificationItem[];
}> {
  await requireProfile();
  const supabase = await createClient();
  const [{ data: items }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
  ]);
  return { unread: count ?? 0, items: (items ?? []) as NotificationItem[] };
}

/** Mark one notification read. update_own RLS scopes it to the caller's rows. */
export async function markNotificationReadAction(id: string): Promise<{ ok: boolean }> {
  await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Mark all the caller's unread notifications read. */
export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  revalidatePath("/dashboard");
  return { ok: true };
}
