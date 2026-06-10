import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { labelOf, CLIENT_STATUSES, PROGRAMS } from "@/lib/constants";
import { ClientTabs } from "@/components/clients/client-tabs";
import { Badge } from "@/components/ui/badge";

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
    .select("id, name, slug, status, program")
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
        <Badge variant={client.status === "active" ? "default" : "secondary"}>
          {labelOf(CLIENT_STATUSES, client.status)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {labelOf(PROGRAMS, client.program)}
        </span>
      </div>
      <ClientTabs clientId={client.id} isAdmin={profile.role === "admin"} />
      <div>{children}</div>
    </div>
  );
}
