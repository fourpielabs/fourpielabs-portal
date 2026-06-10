import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { type ClientUpdateValues } from "@/lib/schemas";
import { ClientEditForm } from "@/components/clients/client-edit-form";
import {
  AssignmentManager,
  type TeamMember,
} from "@/components/clients/assignment-manager";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ClientSettingsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireRole(["admin"]); // P2: client management is admin-only
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, name, slug, industry, program, status, website_url, start_date, service_type, investment, comms_channel, internal_notes",
    )
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  const [{ data: team }, { data: assignments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "team")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("client_assignments")
      .select("user_id")
      .eq("client_id", clientId),
  ]);

  const defaults: ClientUpdateValues = {
    id: client.id,
    name: client.name,
    industry: client.industry,
    program: client.program,
    status: client.status,
    website_url: client.website_url ?? "",
    start_date: client.start_date ?? "",
    service_type: client.service_type ?? "",
    investment: client.investment ?? "",
    comms_channel: client.comms_channel ?? "",
    internal_notes: client.internal_notes ?? "",
  };

  const assignedIds = (assignments ?? []).map((a) => a.user_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {client.name}
          </h1>
          <p className="text-muted-foreground">Client settings · {client.slug}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/clients">Back to clients</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Core client info, program, and status. Setting status to Paused or
            Churned is the soft-delete (no hard delete in v1).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientEditForm defaults={defaults} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team assignments</CardTitle>
          <CardDescription>
            Assigned team members get full access to this client&apos;s
            workspace (enforced by RLS).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssignmentManager
            clientId={client.id}
            team={(team ?? []) as TeamMember[]}
            assignedIds={assignedIds}
          />
        </CardContent>
      </Card>
    </div>
  );
}
