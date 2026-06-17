"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { deliverableSchema, type DeliverableValues } from "@/lib/schemas";
import {
  createDeliverableAction,
  updateDeliverableAction,
} from "@/lib/actions/deliverables";
import { uploadClientFileAction } from "@/lib/actions/storage";
import { DELIVERABLE_TYPES, DELIVERABLE_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { FileDropzone } from "@/components/ui/file-dropzone";
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

export type DeliverableRow = {
  id: string;
  title: string;
  description: string | null;
  type: DeliverableValues["type"];
  status: DeliverableValues["status"];
  due_date: string | null;
  preview_url: string | null;
  visible_to_client: boolean;
  file_path: string | null;
  client_approved_at: string | null;
  project_id: string | null;
};

export type ProjectOption = { id: string; title: string };

// Radix Select can't use "" as an item value; map a sentinel to the empty form value.
const NO_PROJECT = "__none__";

export function DeliverableDialog({
  clientId,
  deliverable,
  trigger,
  projects = [],
  clientType = "program",
}: {
  clientId: string;
  deliverable?: DeliverableRow;
  trigger: React.ReactNode;
  projects?: ProjectOption[];
  clientType?: "program" | "project";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removeFile, setRemoveFile] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<DeliverableValues>({
    resolver: zodResolver(deliverableSchema),
    defaultValues: {
      title: deliverable?.title ?? "",
      description: deliverable?.description ?? "",
      type: deliverable?.type ?? "other",
      status: deliverable?.status ?? "pending",
      due_date: deliverable?.due_date ?? "",
      preview_url: deliverable?.preview_url ?? "",
      visible_to_client: deliverable?.visible_to_client ?? false,
      project_id: deliverable?.project_id ?? "",
    },
  });

  const showProjectPicker = clientType === "project" && projects.length > 0;

  async function onSubmit(values: DeliverableValues) {
    setSubmitting(true);

    // resolve file: upload new one if selected; otherwise leave/clear
    let filePath: string | null | undefined = undefined;
    if (file && file.size > 0) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await uploadClientFileAction(clientId, fd);
      if (!up.ok) {
        setSubmitting(false);
        return toast.error("Upload failed", { description: up.error });
      }
      filePath = up.path;
    } else if (removeFile) {
      filePath = null;
    } else if (!deliverable) {
      filePath = null;
    }

    const res = deliverable
      ? await updateDeliverableAction(clientId, deliverable.id, values, filePath)
      : await createDeliverableAction(clientId, values, filePath);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(deliverable ? "Deliverable updated." : "Deliverable created.");
    setOpen(false);
    if (!deliverable) reset();
    setRemoveFile(false);
    setFile(null);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {deliverable ? "Edit deliverable" : "New deliverable"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="d-title">Title</Label>
            <Input id="d-title" {...register("title")} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-desc">Description</Label>
            <Textarea id="d-desc" rows={3} {...register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERABLE_TYPES.map((o) => (
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
                      {DELIVERABLE_STATUSES.map((o) => (
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
            <div className="space-y-2">
              <Label>Visible to client</Label>
              <Controller
                control={control}
                name="visible_to_client"
                render={({ field }) => (
                  <div className="flex h-9 items-center">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-preview">Preview URL (live link)</Label>
            <Input id="d-preview" {...register("preview_url")} />
            {errors.preview_url && (
              <p className="text-sm text-destructive">
                {errors.preview_url.message}
              </p>
            )}
          </div>
          {showProjectPicker && (
            <div className="space-y-2">
              <Label>Project</Label>
              <Controller
                control={control}
                name="project_id"
                render={({ field }) => (
                  <Select
                    value={field.value ? field.value : NO_PROJECT}
                    onValueChange={(v) =>
                      field.onChange(v === NO_PROJECT ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT}>No project</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-ink-3">
                Link this deliverable to one of the client&apos;s projects.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>{deliverable?.file_path ? "Replace file" : "Attach file"}</Label>
            <FileDropzone onFile={setFile} selectedName={file?.name} />
            {deliverable?.file_path && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={removeFile} onCheckedChange={(v) => setRemoveFile(v === true)} />
                Remove current file
              </label>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" loading={submitting}>
              {submitting ? "Saving…" : deliverable ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
