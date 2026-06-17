import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { labelOf, PROGRAMS } from "@/lib/constants";
import { formatMonthYear } from "@/lib/format";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ClientTabs } from "@/components/clients/client-tabs";
import { StatusChip } from "@/components/ui/status-chip";
import { Badge } from "@/components/ui/badge";
import { WorkspaceContainer } from "@/components/layout/workspace-container";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  // Guard: admin or assigned team only. Unassigned team / clients -> /clients.
  const profile = await requireClientAccess(clientId);

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, slug, status, program, client_type, start_date, logo_url")
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  const isProject = client.client_type === "project";

  // "Day N of 90" is the program roadmap framing — not meaningful for projects.
  let dayLabel: string | null = null;
  if (!isProject && client.start_date) {
    const start = new Date(`${client.start_date}T00:00:00`);
    // eslint-disable-next-line react-hooks/purity -- server component: renders once per request; Date.now() is the intended request-time clock
    const days = Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1;
    if (days >= 1) dayLabel = `Day ${Math.min(days, 90)} of 90`;
  }

  return (
    <WorkspaceContainer>
      <div className="flex flex-wrap items-center gap-3">
        <PersonAvatar name={client.name} src={client.logo_url} square size="lg" className="shrink-0" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.01em]">
              {client.name}
            </h1>
            {isProject ? (
              <Badge variant="secondary">Project</Badge>
            ) : (
              <Badge variant="amber">{labelOf(PROGRAMS, client.program)}</Badge>
            )}
            <StatusChip kind="client" value={client.status} />
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            {client.start_date ? `Client since ${formatMonthYear(client.start_date)}` : ""}
            {dayLabel ? `${client.start_date ? " · " : ""}${dayLabel}` : ""}
          </p>
        </div>
        {profile.role === "admin" && (
          <Link
            href={`/clients/${client.id}/settings`}
            aria-label="Client settings"
            className="ml-auto inline-flex size-9 items-center justify-center rounded-full border border-border-strong text-ink-2 hover:border-ink hover:text-ink"
          >
            <MoreHorizontal className="size-4" />
          </Link>
        )}
      </div>
      <ClientTabs
        clientId={client.id}
        isAdmin={profile.role === "admin"}
        clientType={client.client_type}
      />
      <div>{children}</div>
    </WorkspaceContainer>
  );
}
