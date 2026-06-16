import { requireProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { EmailPreferences } from "@/components/settings/email-preferences";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">
          Your profile
        </h1>
        <p className="text-sm text-ink-2">Manage your photo, name, and password.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
          <CardDescription>Shown across the portal next to your name.</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload name={me.full_name} email={me.email} avatarUrl={me.avatar_url} />
        </CardContent>
      </Card>

      <ProfileForm fullName={me.full_name} email={me.email} role={me.role} />

      <EmailPreferences role={me.role} current={(prefs ?? {}) as Record<string, boolean | null>} />
    </div>
  );
}
