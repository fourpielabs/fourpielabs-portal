"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { deliverableSchema, type DeliverableValues } from "@/lib/schemas";
import { createDeliverableAction, updateDeliverableAction } from "@/lib/actions/deliverables";
import { uploadClientFileAction } from "@/lib/actions/storage";
import { DELIVERABLE_TYPES, DELIVERABLE_STATUSES } from "@/lib/constants";
import { Input, Textarea, Select, Switch, Checkbox } from "@/components/redesign/ui";
import { DateField } from "@/components/redesign/ui/date-field";
import { FileDropzone } from "@/components/redesign/ui/file-dropzone";
import { FormDialog, Field, FieldGrid } from "./ui";

export type DeliverableRow = {
  id: string;
  title: string;
  description: string | null;
  type: DeliverableValues["type"];
  status: DeliverableValues["status"];
  due_date: string | null;
  preview_url: string | null;
  visible_to_client: boolean;
  file_path: string | null;
  client_approved_at: string | null;
  project_id: string | null;
};

export type ProjectOption = { id: string; title: string };

const NO_PROJECT = "__none__";

/** R3 deliverable dialog (re-skinned). Upload→create/update wiring preserved verbatim. */
export function DeliverableDialog({
  clientId, deliverable, trigger, projects = [], clientType = "program",
}: {
  clientId: string;
  deliverable?: DeliverableRow;
  trigger: React.ReactNode;
  projects?: ProjectOption[];
  clientType?: "program" | "project";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removeFile, setRemoveFile] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<DeliverableValues>({
    resolver: zodResolver(deliverableSchema),
    defaultValues: {
      title: deliverable?.title ?? "",
      description: deliverable?.description ?? "",
      type: deliverable?.type ?? "other",
      status: deliverable?.status ?? "pending",
      due_date: deliverable?.due_date ?? "",
      preview_url: deliverable?.preview_url ?? "",
      visible_to_client: deliverable?.visible_to_client ?? false,
      project_id: deliverable?.project_id ?? "",
    },
  });

  const showProjectPicker = clientType === "project" && projects.length > 0;

  async function onSubmit(values: DeliverableValues) {
    setSubmitting(true);
    let filePath: string | null | undefined = undefined;
    if (file && file.size > 0) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await uploadClientFileAction(clientId, fd);
      if (!up.ok) {
        setSubmitting(false);
        return toast.error("Upload failed", { description: up.error });
      }
      filePath = up.path;
    } else if (removeFile) {
      filePath = null;
    } else if (!deliverable) {
      filePath = null;
    }

    const res = deliverable
      ? await updateDeliverableAction(clientId, deliverable.id, values, filePath)
      : await createDeliverableAction(clientId, values, filePath);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(deliverable ? "Deliverable updated." : "Deliverable created.");
    setOpen(false);
    if (!deliverable) reset();
    setRemoveFile(false);
    setFile(null);
    router.refresh();
  }

  return (
    <FormDialog
      title={deliverable ? "Edit deliverable" : "New deliverable"}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      submitting={submitting}
      submitLabel={deliverable ? "Save" : "Create"}
      onSubmit={handleSubmit(onSubmit)}
    >
      <Controller control={control} name="title" render={({ field }) => (
        <Field label="Title" error={errors.title?.message}>
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} />
        </Field>
      )} />
      <Controller control={control} name="description" render={({ field }) => (
        <Field label="Description">
          <Textarea value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" />
        </Field>
      )} />
      <FieldGrid>
        <Controller control={control} name="type" render={({ field }) => (
          <Field label="Type">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {DELIVERABLE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        )} />
        <Controller control={control} name="status" render={({ field }) => (
          <Field label="Status">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {DELIVERABLE_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        )} />
        <Controller control={control} name="due_date" render={({ field }) => (
          <Field label="Due date">
            <DateField value={field.value ?? ""} onChange={field.onChange} />
          </Field>
        )} />
        <Controller control={control} name="visible_to_client" render={({ field }) => (
          <Field label="Visible to client">
            <div style={{ display: "flex", height: 32, alignItems: "center" }}>
              <Switch checked={field.value} onChange={(_, d) => field.onChange(d.checked)} />
            </div>
          </Field>
        )} />
      </FieldGrid>
      <Controller control={control} name="preview_url" render={({ field }) => (
        <Field label="Preview URL (live link)" error={errors.preview_url?.message}>
          <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
        </Field>
      )} />
      {showProjectPicker && (
        <Controller control={control} name="project_id" render={({ field }) => (
          <Field label="Project">
            <Select value={field.value ? field.value : NO_PROJECT} onChange={(e) => field.onChange(e.target.value === NO_PROJECT ? "" : e.target.value)}>
              <option value={NO_PROJECT}>No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </Field>
        )} />
      )}
      <Field label={deliverable?.file_path ? "Replace file" : "Attach file"}>
        <FileDropzone onFile={setFile} selectedName={file?.name} />
        {deliverable?.file_path && (
          <div style={{ marginTop: 8 }}>
            <Checkbox checked={removeFile} onChange={(_, d) => setRemoveFile(d.checked === true)} label="Remove current file" />
          </div>
        )}
      </Field>
    </FormDialog>
  );
}
