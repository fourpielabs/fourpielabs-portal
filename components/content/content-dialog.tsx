"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { contentItemSchema, type ContentItemValues } from "@/lib/schemas";
import {
  createContentItemAction,
  updateContentItemAction,
} from "@/lib/actions/content";
import { CONTENT_PLATFORMS, CONTENT_STATUSES } from "@/lib/constants";
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

export type ContentItem = {
  id: string;
  title: string;
  platform: ContentItemValues["platform"];
  content_type: string | null;
  status: ContentItemValues["status"];
  publish_date: string | null;
  cta: string | null;
  core_message: string | null;
  notes: string | null;
  asset_url: string | null;
  views_after_posting: number | null;
  visible_to_client: boolean;
};

export function ContentDialog({
  clientId,
  item,
  trigger,
}: {
  clientId: string;
  item?: ContentItem;
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
  } = useForm<ContentItemValues>({
    resolver: zodResolver(contentItemSchema),
    defaultValues: {
      title: item?.title ?? "",
      platform: item?.platform ?? "instagram",
      content_type: item?.content_type ?? "",
      status: item?.status ?? "idea",
      publish_date: item?.publish_date ?? "",
      cta: item?.cta ?? "",
      core_message: item?.core_message ?? "",
      notes: item?.notes ?? "",
      asset_url: item?.asset_url ?? "",
      views_after_posting:
        item?.views_after_posting != null ? String(item.views_after_posting) : "",
      visible_to_client: item?.visible_to_client ?? true,
    },
  });

  async function onSubmit(values: ContentItemValues) {
    setSubmitting(true);
    const res = item
      ? await updateContentItemAction(clientId, item.id, values)
      : await createContentItemAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(item ? "Updated." : "Added to calendar.");
    setOpen(false);
    if (!item) reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit content" : "New content"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ci-title">Title / hook</Label>
            <Input id="ci-title" {...register("title")} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Controller
                control={control}
                name="platform"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_PLATFORMS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
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
                      {CONTENT_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci-type">Content type</Label>
              <Input id="ci-type" placeholder="Reel, Carousel, Blog…" {...register("content_type")} />
            </div>
            <div className="space-y-2">
              <Label>Publish date</Label>
              <Controller
                control={control}
                name="publish_date"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ci-msg">Core message</Label>
            <Input id="ci-msg" {...register("core_message")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ci-cta">CTA</Label>
              <Input id="ci-cta" {...register("cta")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci-views">Views after posting</Label>
              <Input id="ci-views" type="number" {...register("views_after_posting")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ci-asset">Asset URL</Label>
            <Input id="ci-asset" {...register("asset_url")} />
            {errors.asset_url && (
              <p className="text-sm text-destructive">{errors.asset_url.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ci-notes">Notes</Label>
            <Textarea id="ci-notes" rows={2} {...register("notes")} />
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
          <DialogFooter>
            <Button type="submit" loading={submitting}>
              {submitting ? "Saving…" : item ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
