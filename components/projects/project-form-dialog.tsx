"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { projectStaffSchema, type ProjectStaffValues } from "@/lib/schemas";
import {
  staffCreateProjectAction,
  staffUpdateProjectAction,
} from "@/lib/actions/projects";
import { PROJECT_STATUSES, PROJECT_PRIORITIES } from "@/lib/constants";
import { Input, Textarea, Select, DateField } from "@/components/redesign/ui";
import { FormDialog, Field, FieldGrid } from "@/components/redesign/staff/ui";

export type StaffProjectRow = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStaffValues["status"];
  priority: ProjectStaffValues["priority"];
  start_date: string | null;
  due_date: string | null;
  target_date: string | null;
};

/**
 * STAFF project create/edit dialog (Warm Obsidian / Fluent). Staff manage everything —
 * including status + the staff start/due schedule (this is the staff write path via
 * staffCreate/UpdateProjectAction; the status control here is correct — the client lock
 * applies only to the client ProjectDialog). RHF + zod + actions unchanged; the legacy
 * DateRangePicker was replaced with two themed DateFields (start / due) so it reads in dark.
 */
export function ProjectFormDialog({
  clientId,
  project,
  trigger,
}: {
  clientId: string;
  project?: StaffProjectRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(project);

  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ProjectStaffValues>({
    resolver: zodResolver(projectStaffSchema),
    defaultValues: {
      title: project?.title ?? "",
      description: project?.description ?? "",
      status: project?.status ?? "proposed",
      priority: project?.priority ?? "medium",
      start_date: project?.start_date ?? "",
      due_date: project?.due_date ?? "",
      target_date: project?.target_date ?? "",
    },
  });

  async function onSubmit(values: ProjectStaffValues) {
    setSubmitting(true);
    const res = isEdit
      ? await staffUpdateProjectAction(clientId, project!.id, values)
      : await staffCreateProjectAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(isEdit ? "Project updated." : "Project created.");
    setOpen(false);
    if (!isEdit) reset();
    router.refresh();
  }

  return (
    <FormDialog
      title={isEdit ? "Edit project" : "New project"}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={isEdit ? "Save" : "Create"}
    >
      <Field label="Title" error={errors.title?.message}>
        <Controller control={control} name="title" render={({ field }) => (
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} placeholder="New website" />
        )} />
      </Field>
      <Field label="Brief">
        <Controller control={control} name="description" render={({ field }) => (
          <Textarea rows={3} value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" placeholder="What's the scope of this project?" />
        )} />
      </Field>
      <FieldGrid>
        <Field label="Status">
          <Controller control={control} name="status" render={({ field }) => (
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)} aria-label="Status">
              {PROJECT_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          )} />
        </Field>
        <Field label="Priority">
          <Controller control={control} name="priority" render={({ field }) => (
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)} aria-label="Priority">
              {PROJECT_PRIORITIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          )} />
        </Field>
      </FieldGrid>
      <FieldGrid>
        <Field label="Start date (staff)">
          <Controller control={control} name="start_date" render={({ field }) => (
            <DateField value={field.value ?? ""} onChange={field.onChange} />
          )} />
        </Field>
        <Field label="Due date (staff)">
          <Controller control={control} name="due_date" render={({ field }) => (
            <DateField value={field.value ?? ""} onChange={field.onChange} />
          )} />
        </Field>
      </FieldGrid>
      <Field label="Client target (their desired date)">
        <Controller control={control} name="target_date" render={({ field }) => (
          <DateField value={field.value ?? ""} onChange={field.onChange} />
        )} />
      </Field>
    </FormDialog>
  );
}
