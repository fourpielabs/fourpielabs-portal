import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { FileText } from "lucide-react";
import { FILE_CATEGORIES, labelOf } from "@/lib/constants";
import { DownloadButton } from "@/components/files/download-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

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
    <PageContainer width="standard" stack>
      <PageHeader
        title="Documents"
        description="Your agreements, forms, and shared files."
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No documents yet"
          description="Your agreements, forms, and shared files will appear here."
        />
      ) : (
        categories.map((cat) => (
          <div key={cat} className="space-y-2">
            <h2 className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">
              {labelOf(FILE_CATEGORIES, cat)}
            </h2>
            <ul className="divide-y divide-row-divider rounded-2xl border border-border">
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
    </PageContainer>
  );
}
