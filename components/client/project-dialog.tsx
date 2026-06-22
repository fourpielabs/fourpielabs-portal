"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  projectCreateSchema,
  projectUpdateSchema,
  type ProjectUpdateValues,
} from "@/lib/schemas";
import {
  createProjectAction,
  updateProjectAction,
} from "@/lib/actions/projects";
import { PROJECT_PRIORITIES } from "@/lib/constants";
import { Input, Textarea, Select, DateField } from "@/components/redesign/ui";
import { FormDialog, Field, FieldGrid } from "@/components/redesign/staff/ui";

export type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  // displayed read-only on the card badge; clients never set it (staff-only).
  status: "proposed" | "active" | "in_review" | "complete";
  // client-settable advanced options (Phase 3).
  priority: "low" | "medium" | "high" | "urgent";
  target_date: string | null;
  due_date: string | null;
  created_at: string;
};

/**
 * Client project create/edit dialog (Warm Obsidian / Fluent). INVARIANT: clients set
 * title + brief + priority + target_date — NEVER status or the staff due_date (both
 * absent from the client RPC; the project-status lock holds). There is deliberately NO
 * status control in this form; the card shows status read-only. RHF + zod + RPC unchanged.
 */
export function ProjectDialog({
  project,
  trigger,
}: {
  project?: ProjectRow;
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
  } = useForm<ProjectUpdateValues>({
    resolver: zodResolver(
      (isEdit ? projectUpdateSchema : projectCreateSchema) as typeof projectUpdateSchema,
    ),
    defaultValues: {
      id: project?.id,
      title: project?.title ?? "",
      description: project?.description ?? "",
      priority: project?.priority ?? "medium",
      target_date: project?.target_date ?? "",
    },
  });

  async function onSubmit(values: ProjectUpdateValues) {
    setSubmitting(true);
    const res = isEdit
      ? await updateProjectAction({
          id: project!.id,
          title: values.title,
          description: values.description,
          priority: values.priority,
          target_date: values.target_date,
        })
      : await createProjectAction({
          title: values.title,
          description: values.description,
          priority: values.priority,
          target_date: values.target_date,
        });
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(isEdit ? "Project updated." : "Project added.");
    setOpen(false);
    if (!isEdit) reset();
    router.refresh();
  }

  return (
    <FormDialog
      title={isEdit ? "Edit project" : "Add a project"}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={isEdit ? "Save" : "Add project"}
    >
      <Field label="Title" error={errors.title?.message}>
        <Controller control={control} name="title" render={({ field }) => (
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} placeholder="New website" />
        )} />
      </Field>
      <Field label="Brief">
        <Controller control={control} name="description" render={({ field }) => (
          <Textarea rows={4} value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" placeholder="What's the goal of this project? Add as much context as you like." />
        )} />
      </Field>
      <FieldGrid>
        <Field label="Priority">
          <Controller control={control} name="priority" render={({ field }) => (
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)} aria-label="Priority">
              {PROJECT_PRIORITIES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          )} />
        </Field>
        <Field label="Target date">
          <Controller control={control} name="target_date" render={({ field }) => (
            <DateField value={field.value ?? ""} onChange={field.onChange} />
          )} />
        </Field>
      </FieldGrid>
    </FormDialog>
  );
}
