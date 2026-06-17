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
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

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
    <PageContainer width="focused" stack>
      <PageHeader
        title="Your profile"
        description="Manage your photo, name, and password."
      />

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
    </PageContainer>
  );
}
