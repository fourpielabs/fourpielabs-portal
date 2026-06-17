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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type StaffTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStaffValues["status"];
  assignee_id: string | null;
  due_date: string | null;
  visible_to_client: boolean;
  source_message_id: string | null;
};

const NONE = "__none__";
const roleLabel = (r: TaskMember["role"]) =>
  r === "client" ? "Client" : r === "admin" ? "Admin" : "Team";

export function TaskFormDialog({
  clientId,
  members,
  task,
  trigger,
}: {
  clientId: string;
  members: TaskMember[];
  task?: StaffTaskRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(task);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TaskStaffValues>({
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" {...register("title")} placeholder="Send brand assets" />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-desc">Details</Label>
            <Textarea id="t-desc" rows={3} {...register("description")} placeholder="What needs to happen?" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Controller
                control={control}
                name="assignee_id"
                render={({ field }) => (
                  <Select
                    value={field.value && field.value.length ? field.value : NONE}
                    onValueChange={(val) => field.onChange(val === NONE ? "" : val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} · {roleLabel(m.role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Controller
                control={control}
                name="due_date"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </div>
          <Controller
            control={control}
            name="visible_to_client"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Visible to the client</span>
                  <span className="block text-xs text-ink-3">
                    {field.value
                      ? "The client sees this task on their Tasks page."
                      : "Internal — staff-only, the client never sees it."}
                  </span>
                </span>
                <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Visible to the client" />
              </label>
            )}
          />
          <DialogFooter>
            <Button type="submit" loading={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
