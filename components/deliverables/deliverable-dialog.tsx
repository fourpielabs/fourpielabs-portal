"use client";

import { useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
};

export function DeliverableDialog({
  clientId,
  deliverable,
  trigger,
}: {
  clientId: string;
  deliverable?: DeliverableRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removeFile, setRemoveFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    },
  });

  async function onSubmit(values: DeliverableValues) {
    setSubmitting(true);

    // resolve file: upload new one if selected; otherwise leave/clear
    let filePath: string | null | undefined = undefined;
    const file = fileRef.current?.files?.[0];
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
              <Label htmlFor="d-due">Due date</Label>
              <Input id="d-due" type="date" {...register("due_date")} />
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
          <div className="space-y-2">
            <Label htmlFor="d-file">
              {deliverable?.file_path ? "Replace file" : "Attach file"}
            </Label>
            <Input id="d-file" type="file" ref={fileRef} />
            {deliverable?.file_path && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={removeFile}
                  onChange={(e) => setRemoveFile(e.target.checked)}
                />
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
