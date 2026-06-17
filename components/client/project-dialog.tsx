"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    reset,
    formState: { errors },
  } = useForm<ProjectUpdateValues>({
    // Clients create/edit title + description only — status is staff-controlled,
    // so there is no status field in this form (the card badge shows it read-only).
    resolver: zodResolver(
      (isEdit ? projectUpdateSchema : projectCreateSchema) as typeof projectUpdateSchema,
    ),
    defaultValues: {
      id: project?.id,
      title: project?.title ?? "",
      description: project?.description ?? "",
    },
  });

  async function onSubmit(values: ProjectUpdateValues) {
    setSubmitting(true);
    const res = isEdit
      ? await updateProjectAction({
          id: project!.id,
          title: values.title,
          description: values.description,
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
