"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { taskClientCreateSchema, type TaskClientCreateValues } from "@/lib/schemas";
import { createTaskAction } from "@/lib/actions/tasks-client";
import type { TaskMember } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const NONE = "__none__";
const roleLabel = (r: TaskMember["role"]) =>
  r === "client" ? "You / your team" : "Your 4Pie team";

/**
 * Client-side "Add task" dialog. Writes go through the create_task RPC (client
 * wrapper in lib/actions/tasks-client.ts). Clients can create + assign within
 * their circle; editing fields beyond status isn't a client capability (only
 * create + status change exist as client RPCs).
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
    register,
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ct-title">Title</Label>
            <Input id="ct-title" {...register("title")} placeholder="Send over our new logo" />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ct-desc">Details</Label>
            <Textarea id="ct-desc" rows={3} {...register("description")} placeholder="Any context?" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Assign to</Label>
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
          <DialogFooter>
            <Button type="submit" loading={submitting}>
              {submitting ? "Adding…" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
