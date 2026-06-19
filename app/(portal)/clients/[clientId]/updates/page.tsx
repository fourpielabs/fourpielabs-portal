import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { UpdatesList, type UpdateItem } from "@/components/redesign/staff/updates-list";

export default async function UpdatesPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: updates } = await supabase
    .from("updates")
    .select("id, title, body, pinned, visible_to_client, author_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const authorIds = [
    ...new Set((updates ?? []).map((u) => u.author_id).filter(Boolean)),
  ] as string[];
  const { data: authors } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", authorIds)
    : { data: [] };
  const nameById = new Map(
    (authors ?? []).map((a) => [a.id, a.full_name ?? a.email ?? "—"]),
  );

  const items: UpdateItem[] = (updates ?? []).map((u) => ({
    ...u,
    author_name: u.author_id ? (nameById.get(u.author_id) ?? "—") : "—",
  }));

  return (
    <div className="space-y-4">
      <UpdatesList
        clientId={clientId}
        updates={items}
        currentUserId={me.id}
        isAdmin={me.role === "admin"}
      />
    </div>
  );
}
