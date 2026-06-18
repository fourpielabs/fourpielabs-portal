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
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ProjectUpdateValues>({
    // Clients set title + brief + priority + target_date — NEVER status or the
    // staff due_date (both absent from the client RPC; the status lock holds). The
    // card badge shows status read-only.
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "Add a project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-title">Title</Label>
            <Input id="p-title" {...register("title")} placeholder="New website" />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">Brief</Label>
            <Textarea
              id="p-desc"
              rows={4}
              {...register("description")}
              placeholder="What's the goal of this project? Add as much context as you like."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_PRIORITIES.map((o) => (
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
              <Label>Target date</Label>
              <Controller
                control={control}
                name="target_date"
                render={({ field }) => (
                  <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" loading={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save" : "Add project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
