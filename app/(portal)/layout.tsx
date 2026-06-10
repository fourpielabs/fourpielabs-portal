import { requireProfile } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  team: "Team",
  client: "Client",
};

/**
 * Portal shell + auth guard. requireProfile() redirects unauthenticated or
 * deactivated users to /login. Full role-aware navigation (team/admin sidebar
 * vs. client top-nav) is built out in P2+. RLS remains the real enforcement.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <span className="inline-block size-3 rounded-full bg-primary" />
            <span className="font-semibold tracking-tight">4Pie Labs</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {profile.full_name ?? profile.email}
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                {ROLE_LABEL[profile.role] ?? profile.role}
              </span>
            </span>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
