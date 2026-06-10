"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { updateSchema, type UpdateValues } from "@/lib/schemas";
import { createUpdateAction, updateUpdateAction } from "@/lib/actions/updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type UpdateRow = {
  id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  visible_to_client: boolean;
};

export function UpdateDialog({
  clientId,
  update,
  trigger,
}: {
  clientId: string;
  update?: UpdateRow;
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
  } = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      title: update?.title ?? "",
      body: update?.body ?? "",
      pinned: update?.pinned ?? false,
      visible_to_client: update?.visible_to_client ?? true,
    },
  });

  async function onSubmit(values: UpdateValues) {
    setSubmitting(true);
    const res = update
      ? await updateUpdateAction(clientId, update.id, values)
      : await createUpdateAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(update ? "Update saved." : "Update posted.");
    setOpen(false);
    if (!update) reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{update ? "Edit update" : "Post an update"}</DialogTitle>
          <DialogDescription>
            Markdown supported. Visible to the client unless turned off.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="u-title">Title</Label>
            <Input id="u-title" {...register("title")} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-body">Body (markdown)</Label>
            <Textarea id="u-body" rows={5} {...register("body")} />
          </div>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="pinned"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label>Pinned</Label>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="visible_to_client"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label>Visible to client</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : update ? "Save" : "Post update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
