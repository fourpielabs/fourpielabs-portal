"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { programSchema, type ProgramValues } from "@/lib/schemas";
import { updateProgramAction } from "@/lib/actions/program";
import { Input, Textarea, EmberButton } from "@/components/redesign/ui";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Field, FieldGrid } from "./ui";

// Keep ProgramValues importable from the original module for one import shape.
export type { ProgramValues } from "@/lib/schemas";

/** R3 program-details form (re-skinned, SOLID). RHF + updateProgramAction wiring verbatim. */
export function ProgramForm({ defaults }: { defaults: ProgramValues }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, setValue, watch } = useForm<ProgramValues>({
    resolver: zodResolver(programSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: ProgramValues) {
    setSubmitting(true);
    const res = await updateProgramAction(values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success("Program details saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <FieldGrid>
        <Controller control={control} name="service_type" render={({ field }) => (
          <Field label="Service type">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="Done For You" />
          </Field>
        )} />
        <Controller control={control} name="investment" render={({ field }) => (
          <Field label="Investment">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="$3,500/mo" />
          </Field>
        )} />
      </FieldGrid>

      <Field label="Program dates">
        <DateRangePicker
          from={watch("start_date")}
          to={watch("end_date")}
          placeholder="Start – end (optional)"
          onChange={(f, t) => {
            setValue("start_date", f, { shouldDirty: true, shouldValidate: true });
            setValue("end_date", t, { shouldDirty: true, shouldValidate: true });
          }}
        />
      </Field>

      <FieldGrid>
        <Controller control={control} name="whats_included" render={({ field }) => (
          <Field label="What's included (markdown)">
            <Textarea value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" rows={4} />
          </Field>
        )} />
        <Controller control={control} name="whats_not_included" render={({ field }) => (
          <Field label="What's not included (markdown)">
            <Textarea value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" rows={4} />
          </Field>
        )} />
      </FieldGrid>

      <FieldGrid>
        <Controller control={control} name="comms_channel" render={({ field }) => (
          <Field label="Comms channel">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="WhatsApp group" />
          </Field>
        )} />
        <Controller control={control} name="best_way_to_reach" render={({ field }) => (
          <Field label="Best way to reach">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
          </Field>
        )} />
        <Controller control={control} name="response_time" render={({ field }) => (
          <Field label="Response time">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="Within 24 hours, weekdays" />
          </Field>
        )} />
        <Controller control={control} name="revision_policy" render={({ field }) => (
          <Field label="Revision policy">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="2 rounds per deliverable" />
          </Field>
        )} />
      </FieldGrid>

      <Controller control={control} name="call_scheduling_note" render={({ field }) => (
        <Field label="Call scheduling note">
          <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
        </Field>
      )} />

      <div>
        <EmberButton type="submit" loading={submitting}>Save program details</EmberButton>
      </div>
    </form>
  );
}
