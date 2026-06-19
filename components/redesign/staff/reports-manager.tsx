"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FileText, Pencil, Plus } from "lucide-react";

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
import { Input, Textarea, Checkbox, EmberButton, Button, StatusPill } from "@/components/redesign/ui";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { StaffDownloadButton } from "./download-button";
import { usePanel, EmptyPanel, FormDialog, Field, ConfirmDelete } from "./ui";

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

/** R3 report dialog (re-skinned). Upload→create/update + remove-PDF wiring preserved verbatim. */
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
  const [pdf, setPdf] = useState<File | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    watch,
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
    if (pdf && pdf.size > 0) {
      const fd = new FormData();
      fd.append("file", pdf);
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
    setPdf(null);
    router.refresh();
  }

  return (
    <FormDialog
      title={report ? "Edit report" : "New report"}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      submitting={submitting}
      submitLabel={report ? "Save" : "Create draft"}
      onSubmit={handleSubmit(onSubmit)}
    >
      <Controller control={control} name="title" render={({ field }) => (
        <Field label="Title" error={errors.title?.message}>
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} placeholder="April 2026 Performance" />
        </Field>
      )} />
      <Field label="Reporting period">
        <DateRangePicker
          from={watch("period_start")}
          to={watch("period_end")}
          placeholder="Period start – end"
          onChange={(f, t) => {
            setValue("period_start", f, { shouldDirty: true, shouldValidate: true });
            setValue("period_end", t, { shouldDirty: true, shouldValidate: true });
          }}
        />
      </Field>
      <Controller control={control} name="summary" render={({ field }) => (
        <Field label="Summary (markdown)">
          <Textarea value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" />
        </Field>
      )} />
      <Field label={report?.pdf_path ? "Replace PDF" : "Attach PDF (optional)"}>
        <FileDropzone onFile={setPdf} selectedName={pdf?.name} accept="application/pdf" hint="PDF only" />
        {report?.pdf_path && (
          <div style={{ marginTop: 8 }}>
            <Checkbox checked={removePdf} onChange={(_, d) => setRemovePdf(d.checked === true)} label="Remove current PDF" />
          </div>
        )}
      </Field>
    </FormDialog>
  );
}

/** R3 staff reports manager (re-skinned, SOLID cards). All wiring verbatim. */
export function ReportsManager({
  clientId,
  reports,
}: {
  clientId: string;
  reports: Report[];
}) {
  const router = useRouter();
  const { panel, fg1, fg2, fg3, mode } = usePanel();
  const [pending, setPending] = useState(false);

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }

  const addBtn = (
    <ReportDialog
      clientId={clientId}
      trigger={<Button appearance="primary" icon={<Plus size={16} />}>New report</Button>}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: fg3 }}>
          {reports.length === 0 ? "No reports yet." : `${reports.length} report${reports.length === 1 ? "" : "s"}`}
        </p>
        {addBtn}
      </div>

      {reports.length === 0 ? (
        <EmptyPanel
          icon={<FileText size={22} />}
          title="No reports yet"
          description="Draft monthly reports here. Clients only ever see PUBLISHED ones."
          action={addBtn}
        />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {reports.map((r) => (
            <li key={r.id} className={panel} style={{ borderRadius: 18, padding: "1rem 1.1rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: fg1 }}>{r.title}</span>
                    <StatusPill value={r.published ? "published" : "draft"} mode={mode} />
                  </div>
                  {(r.period_start || r.period_end) && (
                    <div style={{ fontSize: 12, color: fg3, marginTop: 2 }}>
                      {formatReportPeriod(r.period_start, r.period_end)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexShrink: 0, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                  {r.pdf_path && (
                    <StaffDownloadButton clientId={clientId} path={r.pdf_path} label="PDF" />
                  )}
                  <Button
                    appearance={r.published ? "outline" : "primary"}
                    size="small"
                    disabled={pending}
                    onClick={() => run(setReportPublishedAction(clientId, r.id, !r.published))}
                  >
                    {r.published ? "Unpublish" : "Publish"}
                  </Button>
                  <ReportDialog
                    clientId={clientId}
                    report={r}
                    trigger={
                      <button type="button" aria-label="Edit" className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}>
                        <Pencil size={16} />
                      </button>
                    }
                  />
                  <ConfirmDelete
                    title="Delete report?"
                    description={`“${r.title}” and any attached PDF will be removed.`}
                    onConfirm={() => run(deleteReportAction(clientId, r.id))}
                  />
                </div>
              </div>
              {r.summary && (
                <div className="rd-prose rd-msg" style={{ paddingTop: 8, fontSize: "0.9rem", color: fg2 }}>
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
