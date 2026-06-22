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
import { Input, Textarea, Select, Switch } from "@/components/redesign/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { FormDialog, Field, FieldGrid } from "./ui";

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

/** R3 content dialog (re-skinned). create/update wiring + RHF preserved verbatim. */
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
    <FormDialog
      title={item ? "Edit content" : "New content"}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      submitting={submitting}
      submitLabel={item ? "Save" : "Add"}
      onSubmit={handleSubmit(onSubmit)}
    >
      <Controller control={control} name="title" render={({ field }) => (
        <Field label="Title / hook" error={errors.title?.message}>
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} />
        </Field>
      )} />
      <FieldGrid>
        <Controller control={control} name="platform" render={({ field }) => (
          <Field label="Platform">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {CONTENT_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </Field>
        )} />
        <Controller control={control} name="status" render={({ field }) => (
          <Field label="Status">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {CONTENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
        )} />
        <Controller control={control} name="content_type" render={({ field }) => (
          <Field label="Content type">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="Reel, Carousel, Blog…" />
          </Field>
        )} />
        <Controller control={control} name="publish_date" render={({ field }) => (
          <Field label="Publish date">
            <DatePicker value={field.value ?? ""} onChange={field.onChange} />
          </Field>
        )} />
      </FieldGrid>
      <Controller control={control} name="core_message" render={({ field }) => (
        <Field label="Core message">
          <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
        </Field>
      )} />
      <FieldGrid>
        <Controller control={control} name="cta" render={({ field }) => (
          <Field label="CTA">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
          </Field>
        )} />
        <Controller control={control} name="views_after_posting" render={({ field }) => (
          <Field label="Views after posting">
            <Input type="number" value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
          </Field>
        )} />
      </FieldGrid>
      <Controller control={control} name="asset_url" render={({ field }) => (
        <Field label="Asset URL" error={errors.asset_url?.message}>
          <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
        </Field>
      )} />
      <Controller control={control} name="notes" render={({ field }) => (
        <Field label="Notes">
          <Textarea value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" rows={2} />
        </Field>
      )} />
      <Controller control={control} name="visible_to_client" render={({ field }) => (
        <Field label="Visible to client">
          <div style={{ display: "flex", height: 32, alignItems: "center" }}>
            <Switch checked={field.value} onChange={(_, d) => field.onChange(d.checked)} />
          </div>
        </Field>
      )} />
    </FormDialog>
  );
}
