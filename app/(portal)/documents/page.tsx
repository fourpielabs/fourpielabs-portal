import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { FILE_CATEGORIES, labelOf } from "@/lib/constants";
import { DocumentsBody, type DocCategory } from "@/components/redesign/client/documents-body";

function fmtSize(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function ClientDocumentsPage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  // RLS: visible_to_client files only
  const { data: files } = await supabase
    .from("files")
    .select("id, name, category, storage_path, size_bytes")
    .order("created_at", { ascending: false });
  const list = files ?? [];

  const categories: DocCategory[] = FILE_CATEGORIES.map((c) => ({
    label: labelOf(FILE_CATEGORIES, c.value),
    files: list
      .filter((f) => f.category === c.value)
      .map((f) => ({ id: f.id, name: f.name, size: fmtSize(f.size_bytes), path: f.storage_path })),
  })).filter((c) => c.files.length > 0);

  return <DocumentsBody categories={categories} clientId={profile.client_id!} />;
}
