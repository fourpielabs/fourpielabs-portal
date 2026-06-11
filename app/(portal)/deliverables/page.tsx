import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { DELIVERABLE_STATUSES, DELIVERABLE_TYPES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { DownloadButton } from "@/components/files/download-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { ExternalLink } from "lucide-react";

export default async function ClientDeliverablesPage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  // RLS: visible_to_client deliverables for the client's own client
  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("id, title, description, type, status, due_date, delivered_at, preview_url, file_path")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deliverables</h1>
        <p className="text-muted-foreground">Everything we&apos;re creating for you.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DELIVERABLE_STATUSES.map((s) => (
          <StatusChip key={s.value} kind="deliverable" value={s.value} />
        ))}
      </div>

      {(deliverables ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Your deliverables will appear here as we ship them.
        </div>
      ) : (
        <ul className="space-y-3">
          {(deliverables ?? []).map((d) => (
            <li key={d.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.title}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {labelOf(DELIVERABLE_TYPES, d.type)}
                    </Badge>
                  </div>
                  {d.description && (
                    <p className="pt-1 text-sm text-muted-foreground">
                      {d.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
                    {d.due_date && <span>Due {formatDate(d.due_date)}</span>}
                    {d.delivered_at && (
                      <span>Delivered {formatDate(d.delivered_at)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip kind="deliverable" value={d.status} />
                  {d.preview_url && (
                    <Button asChild variant="outline" size="sm">
                      <a href={d.preview_url} target="_blank" rel="noreferrer">
                        Preview <ExternalLink className="size-3" />
                      </a>
                    </Button>
                  )}
                  {d.file_path && (
                    <DownloadButton
                      clientId={profile.client_id!}
                      path={d.file_path}
                      label="Download"
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
