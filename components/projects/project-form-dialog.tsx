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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
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
    register,
    handleSubmit,
    control,
    setValue,
    watch,
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sp-title">Title</Label>
            <Input id="sp-title" {...register("title")} placeholder="New website" />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sp-desc">Brief</Label>
            <Textarea
              id="sp-desc"
              rows={3}
              {...register("description")}
              placeholder="What's the scope of this project?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Schedule <span className="font-normal text-ink-3">(staff start – due)</span>
              </Label>
              <DateRangePicker
                from={watch("start_date")}
                to={watch("due_date")}
                placeholder="Start – due"
                onChange={(f, t) => {
                  setValue("start_date", f, { shouldDirty: true, shouldValidate: true });
                  setValue("due_date", t, { shouldDirty: true, shouldValidate: true });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Client target <span className="font-normal text-ink-3">(their desired date)</span>
              </Label>
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
              {submitting ? "Saving…" : isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
