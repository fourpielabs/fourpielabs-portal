"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { updateSchema, type UpdateValues } from "@/lib/schemas";
import { createUpdateAction, updateUpdateAction } from "@/lib/actions/updates";
import { Input, Textarea, Switch, tokens } from "@/components/redesign/ui";
import { FormDialog, Field } from "@/components/redesign/staff/ui";

export type UpdateRow = {
  id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  visible_to_client: boolean;
};

/**
 * Update composer (Warm Obsidian / Fluent via the shared FormDialog). RHF + zod +
 * create/updateUpdateAction wiring is unchanged — only the chrome/fields were converted
 * off shadcn (register → Controller-bound Fluent fields) so it reads correctly in dark.
 */
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

  const toggle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: tokens.colorNeutralForeground1, cursor: "pointer" };
  return (
    <FormDialog
      title={update ? "Edit update" : "Post an update"}
      description="Markdown supported. Visible to the client unless turned off."
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={update ? "Save" : "Post update"}
    >
      <Field label="Title" error={errors.title?.message}>
        <Controller control={control} name="title" render={({ field }) => (
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} />
        )} />
      </Field>
      <Field label="Body (markdown)" error={errors.body?.message}>
        <Controller control={control} name="body" render={({ field }) => (
          <Textarea rows={5} value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" />
        )} />
      </Field>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, paddingTop: 2 }}>
        <label style={toggle}>
          <Controller control={control} name="pinned" render={({ field }) => (
            <Switch checked={field.value} onChange={(_, d) => field.onChange(d.checked)} />
          )} />
          Pinned
        </label>
        <label style={toggle}>
          <Controller control={control} name="visible_to_client" render={({ field }) => (
            <Switch checked={field.value} onChange={(_, d) => field.onChange(d.checked)} />
          )} />
          Visible to client
        </label>
      </div>
    </FormDialog>
  );
}
