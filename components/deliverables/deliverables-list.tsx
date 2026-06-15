"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Package, Pencil, Plus, Trash2, ExternalLink } from "lucide-react";

import {
  setDeliverableStatusAction,
  setDeliverableVisibilityAction,
  deleteDeliverableAction,
} from "@/lib/actions/deliverables";
import { DELIVERABLE_TYPES, DELIVERABLE_STATUSES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DownloadButton } from "@/components/files/download-button";
import {
  DeliverableDialog,
  type DeliverableRow,
} from "./deliverable-dialog";

export function DeliverablesList({
  clientId,
  deliverables,
}: {
  clientId: string;
  deliverables: DeliverableRow[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-3">
          {deliverables.length === 0
            ? "No deliverables yet."
            : `${deliverables.length} deliverable${deliverables.length === 1 ? "" : "s"}`}
        </p>
        <DeliverableDialog
          clientId={clientId}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> New deliverable
            </Button>
          }
        />
      </div>

      {deliverables.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="No deliverables yet"
          description="Track everything you're delivering here — drafts, links, and files."
        />
      ) : (
        <ul className="space-y-2">
          {deliverables.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-e1 transition-shadow hover:shadow-e2 sm:flex-nowrap"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{d.title}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {labelOf(DELIVERABLE_TYPES, d.type)}
                  </Badge>
                  {!d.visible_to_client && (
                    <Badge variant="outline" className="text-[10px]">
                      hidden
                    </Badge>
                  )}
                  {d.due_date && (
                    <span className="text-xs text-ink-3">
                      due {formatDate(d.due_date)}
                    </span>
                  )}
                </div>
                {d.description && (
                  <p className="pt-1 text-sm text-ink-3">
                    {d.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {d.preview_url && (
                    <Button asChild variant="ghost" size="sm">
                      <a href={d.preview_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3" /> Preview
                      </a>
                    </Button>
                  )}
                  {d.file_path && (
                    <DownloadButton
                      clientId={clientId}
                      path={d.file_path}
                      label="File"
                      variant="ghost"
                    />
                  )}
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1 sm:w-auto">
                <Select
                  value={d.status}
                  onValueChange={(s) =>
                    run(
                      setDeliverableStatusAction(
                        clientId,
                        d.id,
                        s as DeliverableRow["status"],
                      ),
                    )
                  }
                >
                  <SelectTrigger size="sm" className="w-[8.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() =>
                    run(
                      setDeliverableVisibilityAction(
                        clientId,
                        d.id,
                        !d.visible_to_client,
                      ),
                    )
                  }
                  aria-label="Toggle visibility"
                >
                  {d.visible_to_client ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="size-4" />
                  )}
                </Button>
                <DeliverableDialog
                  clientId={clientId}
                  deliverable={d}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label="Edit">
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Delete">
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete deliverable?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &ldquo;{d.title}&rdquo; and any attached file will be
                        removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => run(deleteDeliverableAction(clientId, d.id))}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
