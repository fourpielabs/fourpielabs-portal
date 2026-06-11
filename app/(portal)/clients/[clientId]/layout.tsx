import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { labelOf, PROGRAMS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { ClientTabs } from "@/components/clients/client-tabs";
import { StatusChip } from "@/components/ui/status-chip";

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
    .select("id, name, slug, status, program, start_date")
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  let dayLabel: string | null = null;
  if (client.start_date) {
    const start = new Date(`${client.start_date}T00:00:00`);
    const days = Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1;
    if (days >= 1) dayLabel = `Day ${Math.min(days, 90)} of 90`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-amber-100 text-sm font-bold text-amber-800">
          {initials(client.name, null)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.01em]">
              {client.name}
            </h1>
            <StatusChip kind="client" value={client.status} />
          </div>
          <p className="mt-0.5 text-sm text-ink-3">
            {labelOf(PROGRAMS, client.program)}
            {dayLabel ? ` · ${dayLabel}` : ""}
          </p>
        </div>
      </div>
      <ClientTabs clientId={client.id} isAdmin={profile.role === "admin"} />
      <div>{children}</div>
    </div>
  );
}
