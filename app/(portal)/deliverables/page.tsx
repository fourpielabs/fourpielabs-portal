import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { DELIVERABLE_TYPES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { DownloadButton } from "@/components/files/download-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { DeliverableApprove } from "@/components/client/deliverable-approve";
import { ExternalLink, Package } from "lucide-react";

export default async function ClientDeliverablesPage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  // RLS: visible_to_client deliverables for the client's own client
  const { data: deliverables } = await supabase
    .from("deliverables")
    .select(
      "id, title, description, type, status, due_date, delivered_at, preview_url, file_path, client_approved_at",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">Deliverables</h1>
        <p className="text-ink-2">Everything we&apos;re creating for you.</p>
      </div>

      {(deliverables ?? []).length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="Nothing here yet"
          description="Your deliverables will appear here as we ship them."
        />
      ) : (
        <ul className="space-y-3">
          {(deliverables ?? []).map((d) => (
            <li
              key={d.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-e1 transition-shadow hover:shadow-e2"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.title}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {labelOf(DELIVERABLE_TYPES, d.type)}
                    </Badge>
                  </div>
                  {d.description && (
                    <p className="pt-1 text-sm text-ink-2">{d.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 pt-1 text-xs text-ink-3">
                    {d.due_date && <span>Due {formatDate(d.due_date)}</span>}
                    {d.delivered_at && <span>Delivered {formatDate(d.delivered_at)}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip kind="deliverable" value={d.status} />
                  {(d.status === "needs_review" || d.client_approved_at) && (
                    <DeliverableApprove id={d.id} approved={!!d.client_approved_at} />
                  )}
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
