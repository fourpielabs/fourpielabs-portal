import { requireProfile } from "@/lib/auth/guards";
import { ProfileForm } from "@/components/settings/profile-form";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SettingsPage() {
  const me = await requireProfile();

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
    </div>
  );
}
