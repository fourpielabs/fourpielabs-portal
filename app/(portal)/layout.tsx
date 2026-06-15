import { requireProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ClientShell } from "@/components/shell/client-shell";
import { StaffShell, type ClientOption } from "@/components/shell/staff-shell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  if (profile.role === "client") {
    // client_type drives which top-level tabs render (project clients don't get
    // the program-specific Program/Performance tabs). Read via the safe view.
    const clientSupabase = await createClient();
    const { data: c } = await clientSupabase
      .from("client_clients")
      .select("client_type")
      .maybeSingle();
    return (
      <ClientShell
        name={profile.full_name}
        email={profile.email}
        avatarUrl={profile.avatar_url}
        clientType={(c?.client_type as "program" | "project") ?? "program"}
      >
        {children}
      </ClientShell>
    );
  }

  // staff (admin/team): RLS-scoped client list powers the sidebar switcher
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name");

  return (
    <StaffShell
      role={profile.role}
      name={profile.full_name}
      email={profile.email}
      avatarUrl={profile.avatar_url}
      clients={(clients ?? []) as ClientOption[]}
    >
      {children}
    </StaffShell>
  );
}
