import { requireProfile } from "@/lib/auth/guards";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function SettingsPage() {
  const me = await requireProfile();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">
          Your profile
        </h1>
        <p className="text-sm text-ink-2">Manage your name and password.</p>
      </div>
      <ProfileForm fullName={me.full_name} email={me.email} role={me.role} />
    </div>
  );
}
