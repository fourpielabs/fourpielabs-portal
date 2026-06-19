import "../(redesign)/redesign.css";
import { requireProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getNotificationsAction } from "@/lib/actions/notifications";
import { GriffelRegistry } from "@/components/redesign/griffel-registry";
import { RedesignModeProvider } from "@/components/redesign/themed-fluent";
import { ClientShell } from "@/components/redesign/shell/client-shell";
import { StaffShell, type ClientOption } from "@/components/redesign/shell/staff-shell";

/**
 * R1: the portal now runs on the ember-glass shells. Data fetching is UNCHANGED
 * (requireProfile, notifications snapshot, client_type, RLS-scoped client list) —
 * only the shell components + providers (Griffel SSR + redesign mode) are swapped.
 * The page BODIES (children) are still the live R1 screens; they render inside the
 * shells but OUTSIDE FluentProvider (the shells scope Fluent to chrome only), so the
 * old bodies are untouched until R2/R3 convert them.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const notif = await getNotificationsAction();

  if (profile.role === "client") {
    const clientSupabase = await createClient();
    const { data: c } = await clientSupabase
      .from("client_clients")
      .select("client_type")
      .maybeSingle();
    return (
      <GriffelRegistry>
        <RedesignModeProvider defaultMode="light">
          <ClientShell
            name={profile.full_name}
            email={profile.email}
            avatarUrl={profile.avatar_url}
            clientType={(c?.client_type as "program" | "project") ?? "program"}
            notifUnread={notif.unread}
            notifItems={notif.items}
          >
            {children}
          </ClientShell>
        </RedesignModeProvider>
      </GriffelRegistry>
    );
  }

  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  return (
    <GriffelRegistry>
      <RedesignModeProvider defaultMode="light">
        <StaffShell
          role={profile.role}
          name={profile.full_name}
          email={profile.email}
          avatarUrl={profile.avatar_url}
          clients={(clients ?? []) as ClientOption[]}
          notifUnread={notif.unread}
          notifItems={notif.items}
        >
          {children}
        </StaffShell>
      </RedesignModeProvider>
    </GriffelRegistry>
  );
}
