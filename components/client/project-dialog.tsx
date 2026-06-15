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
import { PROJECT_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  status: ProjectUpdateValues["status"];
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
    // create mode validates title/description only; edit also validates status.
    resolver: zodResolver(
      (isEdit ? projectUpdateSchema : projectCreateSchema) as typeof projectUpdateSchema,
    ),
    defaultValues: {
      id: project?.id,
      title: project?.title ?? "",
      description: project?.description ?? "",
      status: project?.status ?? "proposed",
    },
  });

  async function onSubmit(values: ProjectUpdateValues) {
    setSubmitting(true);
    const res = isEdit
      ? await updateProjectAction({
          id: project!.id,
          title: values.title,
          description: values.description,
          status: values.status,
        })
      : await createProjectAction({
          title: values.title,
          description: values.description,
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
            <Label htmlFor="p-desc">Description</Label>
            <Textarea
              id="p-desc"
              rows={3}
              {...register("description")}
              placeholder="What's the goal of this project?"
            />
          </div>
          {isEdit && (
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
                      {PROJECT_STATUSES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
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
