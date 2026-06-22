"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { taskStaffSchema, type TaskStaffValues } from "@/lib/schemas";
import { staffCreateTaskAction, staffUpdateTaskAction } from "@/lib/actions/tasks";
import { TASK_STATUSES } from "@/lib/constants";
import type { TaskMember } from "@/lib/tasks";
import { Input, Textarea, Select, Switch } from "@/components/redesign/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { FormDialog, Field, FieldGrid, usePanel } from "./ui";

export type StaffTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStaffValues["status"];
  assignee_id: string | null;
  due_date: string | null;
  visible_to_client: boolean;
  source_message_id: string | null;
  is_milestone?: boolean;
  blocked_by_client?: boolean;
  blocked_reason?: string | null;
  client_signed_off_at?: string | null;
};

const NONE = "__none__";
const roleLabel = (r: TaskMember["role"]) => (r === "client" ? "Client" : r === "admin" ? "Admin" : "Team");

/** R3 staff task form dialog (re-skinned). create/update + assignee circle wiring verbatim. */
export function TaskFormDialog({
  clientId, members, task, trigger,
}: {
  clientId: string;
  members: TaskMember[];
  task?: StaffTaskRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const { fg1, fg3, border } = usePanel();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(task);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<TaskStaffValues>({
    resolver: zodResolver(taskStaffSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: task?.status ?? "todo",
      assignee_id: task?.assignee_id ?? "",
      due_date: task?.due_date ?? "",
      visible_to_client: task?.visible_to_client ?? true,
      source_message_id: task?.source_message_id ?? "",
    },
  });

  async function onSubmit(values: TaskStaffValues) {
    setSubmitting(true);
    const res = isEdit
      ? await staffUpdateTaskAction(clientId, task!.id, values)
      : await staffCreateTaskAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(isEdit ? "Task updated." : "Task created.");
    setOpen(false);
    if (!isEdit) reset();
    router.refresh();
  }

  return (
    <FormDialog
      title={isEdit ? "Edit task" : "New task"}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      submitting={submitting}
      submitLabel={isEdit ? "Save" : "Create"}
      onSubmit={handleSubmit(onSubmit)}
    >
      <Controller control={control} name="title" render={({ field }) => (
        <Field label="Title" error={errors.title?.message}>
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} placeholder="Send brand assets" />
        </Field>
      )} />
      <Controller control={control} name="description" render={({ field }) => (
        <Field label="Details">
          <Textarea value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" placeholder="What needs to happen?" />
        </Field>
      )} />
      <FieldGrid>
        <Controller control={control} name="assignee_id" render={({ field }) => (
          <Field label="Assignee">
            <Select value={field.value && field.value.length ? field.value : NONE} onChange={(e) => field.onChange(e.target.value === NONE ? "" : e.target.value)}>
              <option value={NONE}>Unassigned</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name} · {roleLabel(m.role)}</option>)}
            </Select>
          </Field>
        )} />
        <Controller control={control} name="status" render={({ field }) => (
          <Field label="Status">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {TASK_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        )} />
      </FieldGrid>
      <Controller control={control} name="due_date" render={({ field }) => (
        <Field label="Due date">
          <DatePicker value={field.value ?? ""} onChange={field.onChange} />
        </Field>
      )} />
      <Controller control={control} name="visible_to_client" render={({ field }) => (
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderRadius: 12, border: `1px solid ${border}`, padding: "0.6rem 0.85rem", cursor: "pointer" }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: fg1 }}>Visible to the client</span>
            <span style={{ display: "block", fontSize: 12, color: fg3 }}>
              {field.value ? "The client sees this task on their Tasks page." : "Internal — staff-only, the client never sees it."}
            </span>
          </span>
          <Switch checked={field.value} onChange={(_, d) => field.onChange(d.checked)} aria-label="Visible to the client" />
        </label>
      )} />
    </FormDialog>
  );
}
