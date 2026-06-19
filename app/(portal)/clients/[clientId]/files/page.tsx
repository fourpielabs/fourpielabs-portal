import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { FilesBody, type FileRow } from "@/components/redesign/staff/files-body";

export default async function FilesPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: files } = await supabase
    .from("files")
    .select("id, name, category, storage_path, size_bytes, visible_to_client, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return <FilesBody clientId={clientId} files={(files ?? []) as FileRow[]} />;
}
