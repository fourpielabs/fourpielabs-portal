"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { checklistItemSchema, type ChecklistItemValues } from "@/lib/schemas";
import { createChecklistItemAction, updateChecklistItemAction } from "@/lib/actions/checklist";
import { Input, Select, Switch } from "@/components/redesign/ui";
import { FormDialog, Field, FieldGrid } from "./ui";

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

/** R3 checklist item dialog (re-skinned). Wiring (RHF + create/update actions) verbatim. */
export function ChecklistItemDialog({ clientId, kind, item, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, reset, formState: { errors } } = useForm<ChecklistItemValues>({
    resolver: zodResolver(checklistItemSchema),
    defaultValues: {
      title: item?.title ?? "",
      phase_label: item?.phase_label ?? "",
      link_url: item?.link_url ?? "",
      assignee: item?.assignee ?? "client",
      visible_to_client: item?.visible_to_client ?? kind === "onboarding",
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
    <FormDialog
      title={item ? "Edit item" : "Add item"}
      description={`${kind === "onboarding" ? "Onboarding" : "Off-boarding"} checklist item.`}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      submitting={submitting}
      submitLabel={item ? "Save" : "Add item"}
      onSubmit={handleSubmit(onSubmit)}
    >
      <Controller control={control} name="title" render={({ field }) => (
        <Field label="Title" error={errors.title?.message}>
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} onBlur={field.onBlur} />
        </Field>
      )} />
      <Controller control={control} name="phase_label" render={({ field }) => (
        <Field label="Phase label">
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} placeholder="Phase 1 — Before We Start" />
        </Field>
      )} />
      <Controller control={control} name="link_url" render={({ field }) => (
        <Field label="Link URL" error={errors.link_url?.message}>
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} placeholder="https://…" />
        </Field>
      )} />
      <FieldGrid>
        <Controller control={control} name="assignee" render={({ field }) => (
          <Field label="Assignee">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              <option value="client">Client</option>
              <option value="team">Team</option>
            </Select>
          </Field>
        )} />
        <Controller control={control} name="visible_to_client" render={({ field }) => (
          <Field label="Visible to client">
            <div style={{ display: "flex", height: 32, alignItems: "center" }}>
              <Switch checked={field.value} onChange={(_, d) => field.onChange(d.checked)} />
            </div>
          </Field>
        )} />
      </FieldGrid>
    </FormDialog>
  );
}
