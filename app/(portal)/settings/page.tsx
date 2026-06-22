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

  // Client business-profile (3c): the client's own safe fields + which they may edit.
  let businessProfile: { website_url: string | null; comms_channel: string | null } | undefined;
  let fieldPermissions: { can_edit_website_url: boolean; can_edit_comms_channel: boolean } | undefined;
  if (me.role === "client") {
    const [{ data: c }, { data: perms }] = await Promise.all([
      supabase.from("client_clients").select("website_url, comms_channel").maybeSingle(),
      supabase.from("client_field_permissions").select("can_edit_website_url, can_edit_comms_channel").maybeSingle(),
    ]);
    businessProfile = { website_url: c?.website_url ?? null, comms_channel: c?.comms_channel ?? null };
    fieldPermissions = {
      can_edit_website_url: perms?.can_edit_website_url ?? false,
      can_edit_comms_channel: perms?.can_edit_comms_channel ?? false,
    };
  }

  return (
    <SettingsBody
      fullName={me.full_name}
      email={me.email}
      role={me.role}
      avatarUrl={me.avatar_url}
      prefs={(prefs ?? {}) as Record<string, boolean | null>}
      businessProfile={businessProfile}
      fieldPermissions={fieldPermissions}
    />
  );
}
