"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { checklistItemSchema, type ChecklistItemValues } from "@/lib/schemas";
import {
  createChecklistItemAction,
  updateChecklistItemAction,
} from "@/lib/actions/checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  clientId: string;
  kind: "onboarding" | "offboarding";
  item?: {
    id: string;
    title: string;
    phase_label: string | null;
    link_url: string | null;
    assignee: "client" | "team";
    visible_to_client: boolean;
  };
  trigger: React.ReactNode;
};

export function ChecklistItemDialog({ clientId, kind, item, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ChecklistItemValues>({
    resolver: zodResolver(checklistItemSchema),
    defaultValues: {
      title: item?.title ?? "",
      phase_label: item?.phase_label ?? "",
      link_url: item?.link_url ?? "",
      assignee: item?.assignee ?? "client",
      visible_to_client: item?.visible_to_client ?? (kind === "onboarding"),
    },
  });

  async function onSubmit(values: ChecklistItemValues) {
    setSubmitting(true);
    const res = item
      ? await updateChecklistItemAction(clientId, item.id, values)
      : await createChecklistItemAction(clientId, kind, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(item ? "Item updated." : "Item added.");
    setOpen(false);
    if (!item) reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
          <DialogDescription>
            {kind === "onboarding" ? "Onboarding" : "Off-boarding"} checklist item.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phase_label">Phase label</Label>
            <Input
              id="phase_label"
              placeholder="Phase 1 — Before We Start"
              {...register("phase_label")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link_url">Link URL</Label>
            <Input id="link_url" {...register("link_url")} />
            {errors.link_url && (
              <p className="text-sm text-destructive">{errors.link_url.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Controller
                control={control}
                name="assignee"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" loading={submitting}>
              {submitting ? "Saving…" : item ? "Save" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
