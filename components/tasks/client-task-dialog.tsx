"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { taskClientCreateSchema, type TaskClientCreateValues } from "@/lib/schemas";
import { createTaskAction } from "@/lib/actions/tasks-client";
import type { TaskMember } from "@/lib/tasks";
import { Input, Textarea, Select, DateField } from "@/components/redesign/ui";
import { FormDialog, Field, FieldGrid } from "@/components/redesign/staff/ui";

const NONE = "__none__";
const roleLabel = (r: TaskMember["role"]) =>
  r === "client" ? "You / your team" : "Your 4Pie team";

/**
 * Client-side "Add task" dialog (Warm Obsidian / Fluent). Writes go through the
 * create_task RPC (createTaskAction). INVARIANT: clients create + assign within their
 * circle but CANNOT set status — there is deliberately NO status control here (status is
 * server-set to 'todo'); the converted body keeps that exactly. RHF + zod + RPC unchanged.
 */
export function ClientTaskDialog({
  members,
  trigger,
}: {
  members: TaskMember[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TaskClientCreateValues>({
    resolver: zodResolver(taskClientCreateSchema),
    defaultValues: { title: "", description: "", assignee_id: "", due_date: "", source_message_id: "" },
  });

  async function onSubmit(values: TaskClientCreateValues) {
    setSubmitting(true);
    const res = await createTaskAction(values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't add task", { description: res.error });
    toast.success("Task added.");
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <FormDialog
      title="Add a task"
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Add task"
    >
      <Field label="Title" error={errors.title?.message}>
        <Controller control={control} name="title" render={({ field }) => (
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} placeholder="Send over our new logo" />
        )} />
      </Field>
      <Field label="Details">
        <Controller control={control} name="description" render={({ field }) => (
          <Textarea rows={3} value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" placeholder="Any context?" />
        )} />
      </Field>
      <FieldGrid>
        <Field label="Assign to">
          <Controller control={control} name="assignee_id" render={({ field }) => (
            <Select
              value={field.value && field.value.length ? field.value : NONE}
              onChange={(e) => field.onChange(e.target.value === NONE ? "" : e.target.value)}
              aria-label="Assign to"
            >
              <option value={NONE}>Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name} · {roleLabel(m.role)}</option>
              ))}
            </Select>
          )} />
        </Field>
        <Field label="Due date">
          <Controller control={control} name="due_date" render={({ field }) => (
            <DateField value={field.value} onChange={field.onChange} />
          )} />
        </Field>
      </FieldGrid>
    </FormDialog>
  );
}
