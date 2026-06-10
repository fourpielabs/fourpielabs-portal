import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { FILE_CATEGORIES, labelOf } from "@/lib/constants";
import { DownloadButton } from "@/components/files/download-button";

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
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
  const categories = FILE_CATEGORIES.map((c) => c.value).filter((cat) =>
    list.some((f) => f.category === cat),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">Your agreements, forms, and shared files.</p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Shared documents will appear here.
        </div>
      ) : (
        categories.map((cat) => (
          <div key={cat} className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              {labelOf(FILE_CATEGORIES, cat)}
            </h2>
            <ul className="divide-y rounded-lg border">
              {list
                .filter((f) => f.category === cat)
                .map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{f.name}</div>
                      {f.size_bytes && (
                        <div className="text-xs text-muted-foreground">
                          {fmtSize(f.size_bytes)}
                        </div>
                      )}
                    </div>
                    <DownloadButton
                      clientId={profile.client_id!}
                      path={f.storage_path}
                    />
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
