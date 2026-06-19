import { requireProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SettingsBody } from "@/components/redesign/client/settings-body";

export default async function SettingsPage() {
  const me = await requireProfile();
  // RLS exposes only the caller's own row; absence → the UI defaults all toggles on.
  const supabase = await createClient();
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", me.id)
    .maybeSingle();

  return (
    <SettingsBody
      fullName={me.full_name}
      email={me.email}
      role={me.role}
      avatarUrl={me.avatar_url}
      prefs={(prefs ?? {}) as Record<string, boolean | null>}
    />
  );
}
