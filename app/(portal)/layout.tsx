import Link from "next/link";
import { requireProfile } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { PortalNav, type NavItem } from "@/components/portal-nav";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  team: "Team",
  client: "Client",
};

function navFor(role: string): NavItem[] {
  if (role === "client") {
    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/program", label: "Program" },
      { href: "/content", label: "Content" },
      { href: "/performance", label: "Performance" },
      { href: "/deliverables", label: "Deliverables" },
      { href: "/calls-notes", label: "Calls & Notes" },
      { href: "/documents", label: "Documents" },
    ];
  }
  const items: NavItem[] = [{ href: "/dashboard", label: "Dashboard" }];
  if (role === "admin" || role === "team") {
    items.push({ href: "/clients", label: "Clients" });
  }
  if (role === "admin") {
    items.push(
      { href: "/admin/users", label: "Users" },
      { href: "/admin/audit", label: "Audit" },
    );
  }
  return items;
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const nav = navFor(profile.role);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="inline-block size-3 rounded-full bg-primary" />
              <span className="font-semibold tracking-tight">4Pie Labs</span>
            </Link>
            <PortalNav items={nav} className="hidden items-center gap-1 sm:flex" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              <span className="hidden sm:inline">
                {profile.full_name ?? profile.email}
              </span>
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
        <PortalNav
          items={nav}
          className="flex items-center gap-1 overflow-x-auto px-4 pb-2 sm:hidden"
        />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
