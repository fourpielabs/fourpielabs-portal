"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { reportSchema, type ReportValues } from "@/lib/schemas";
import { formatReportPeriod } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import {
  createReportAction,
  updateReportAction,
  deleteReportAction,
  setReportPublishedAction,
} from "@/lib/actions/reports";
import { uploadClientFileAction } from "@/lib/actions/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export type Report = {
  id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  pdf_path: string | null;
  published: boolean;
  published_at: string | null;
};

function ReportDialog({
  clientId,
  report,
  trigger,
}: {
  clientId: string;
  report?: Report;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removePdf, setRemovePdf] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReportValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      title: report?.title ?? "",
      period_start: report?.period_start ?? "",
      period_end: report?.period_end ?? "",
      summary: report?.summary ?? "",
    },
  });

  async function onSubmit(values: ReportValues) {
    setSubmitting(true);
    let pdfPath: string | null | undefined = undefined;
    const file = fileRef.current?.files?.[0];
    if (file && file.size > 0) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await uploadClientFileAction(clientId, fd);
      if (!up.ok) {
        setSubmitting(false);
        return toast.error("Upload failed", { description: up.error });
      }
      pdfPath = up.path;
    } else if (removePdf) {
      pdfPath = null;
    }

    const res = report
      ? await updateReportAction(clientId, report.id, values, pdfPath)
      : await createReportAction(clientId, values, pdfPath);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(report ? "Report saved." : "Report created (draft).");
    setOpen(false);
    if (!report) reset();
    setRemovePdf(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{report ? "Edit report" : "New report"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-title">Title</Label>
            <Input id="rp-title" placeholder="April 2026 Performance" {...register("title")} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rp-start">Period start</Label>
              <Input id="rp-start" type="date" {...register("period_start")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-end">Period end</Label>
              <Input id="rp-end" type="date" {...register("period_end")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-summary">Summary (markdown)</Label>
            <Textarea id="rp-summary" rows={5} {...register("summary")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-pdf">
              {report?.pdf_path ? "Replace PDF" : "Attach PDF (optional)"}
            </Label>
            <Input id="rp-pdf" type="file" accept="application/pdf" ref={fileRef} />
            {report?.pdf_path && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={removePdf}
                  onChange={(e) => setRemovePdf(e.target.checked)}
                />
                Remove current PDF
              </label>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" loading={submitting}>
              {submitting ? "Saving…" : report ? "Save" : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReportsManager({
  clientId,
  reports,
}: {
  clientId: string;
  reports: Report[];
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
        <p className="text-sm text-muted-foreground">
          {reports.length === 0
            ? "No reports yet."
            : `${reports.length} report${reports.length === 1 ? "" : "s"}`}
        </p>
        <ReportDialog
          clientId={clientId}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> New report
            </Button>
          }
        />
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Draft monthly reports here. Clients only ever see PUBLISHED ones.
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-e1 transition-shadow hover:shadow-e2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.title}</span>
                    <StatusChip kind="report" value={r.published ? "published" : "draft"} />
                  </div>
                  {(r.period_start || r.period_end) && (
                    <div className="text-xs text-ink-3">
                      {formatReportPeriod(r.period_start, r.period_end)}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  {r.pdf_path && (
                    <DownloadButton
                      clientId={clientId}
                      path={r.pdf_path}
                      label="PDF"
                      variant="ghost"
                    />
                  )}
                  <Button
                    variant={r.published ? "outline" : "default"}
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(setReportPublishedAction(clientId, r.id, !r.published))
                    }
                  >
                    {r.published ? "Unpublish" : "Publish"}
                  </Button>
                  <ReportDialog
                    clientId={clientId}
                    report={r}
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
                        <AlertDialogTitle>Delete report?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{r.title}&rdquo; and any attached PDF will be
                          removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => run(deleteReportAction(clientId, r.id))}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {r.summary && (
                <div className="pt-2 text-sm text-ink-2">
                  <Markdown>{r.summary}</Markdown>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
