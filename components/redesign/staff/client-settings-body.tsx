"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { clientUpdateSchema, type ClientUpdateValues } from "@/lib/schemas";
import { updateClientAction } from "@/lib/actions/clients";
import { INDUSTRIES, PROGRAMS, CLIENT_STATUSES } from "@/lib/constants";
import { Input, Textarea, Select, EmberButton } from "@/components/redesign/ui";
import { DateField } from "@/components/redesign/ui/date-field";
import { TitledPanel, Field, FieldGrid, usePanel } from "./ui";
import { AssignmentManager, type TeamMember } from "./assignment-manager";

// Keep ClientUpdateValues importable from this module for one import shape.
export type { ClientUpdateValues } from "@/lib/schemas";

/** R3 client-details edit form (re-skinned, SOLID). RHF + updateClientAction wiring verbatim. */
export function ClientEditForm({ defaults }: { defaults: ClientUpdateValues }) {
  const router = useRouter();
  const { fg3 } = usePanel();
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<ClientUpdateValues>({
    resolver: zodResolver(clientUpdateSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: ClientUpdateValues) {
    setSubmitting(true);
    const res = await updateClientAction(values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success("Client saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <Controller control={control} name="name" render={({ field }) => (
        <Field label="Business name" error={errors.name?.message}>
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} />
        </Field>
      )} />

      <FieldGrid>
        <Controller control={control} name="industry" render={({ field }) => (
          <Field label="Industry">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)} style={{ width: "100%" }}>
              {INDUSTRIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        )} />
        <Controller control={control} name="program" render={({ field }) => (
          <Field label="Program">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)} style={{ width: "100%" }}>
              {PROGRAMS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        )} />
        <Controller control={control} name="status" render={({ field }) => (
          <Field label="Status">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)} style={{ width: "100%" }}>
              {CLIENT_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        )} />
        <Controller control={control} name="start_date" render={({ field }) => (
          <Field label="Start date">
            <DateField value={field.value ?? ""} onChange={field.onChange} />
          </Field>
        )} />
      </FieldGrid>

      <FieldGrid>
        <Controller control={control} name="website_url" render={({ field }) => (
          <Field label="Website" error={errors.website_url?.message}>
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
          </Field>
        )} />
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
        <Controller control={control} name="comms_channel" render={({ field }) => (
          <Field label="Comms channel">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="WhatsApp group" />
          </Field>
        )} />
      </FieldGrid>

      <Controller control={control} name="internal_notes" render={({ field }) => (
        <Field label="Internal notes (never visible to the client)">
          <Textarea value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" rows={3} />
          <span style={{ fontSize: 12, color: fg3 }}>Private staff-only notes — clients never see this field.</span>
        </Field>
      )} />

      <div>
        <EmberButton type="submit" loading={submitting}>Save changes</EmberButton>
      </div>
    </form>
  );
}

/**
 * R3 staff client SETTINGS tab body (admin-only) — two SOLID TitledPanel sections
 * (re-skinning the old Card wrappers) holding the client-details edit form + the
 * team-assignment manager. Rendered INSIDE the per-client workspace chrome's
 * FluentScope, so it renders content directly (no StaffPageFrame). All mutation
 * wiring lives in the children (RHF + server actions, verbatim).
 */
export function ClientSettingsBody({
  defaults,
  clientId,
  team,
  assignedIds,
}: {
  defaults: ClientUpdateValues;
  clientId: string;
  team: TeamMember[];
  assignedIds: string[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <TitledPanel
        title="Client details"
        description="Core client info, program, and status. Setting status to Paused or Churned is the soft-delete (no hard delete in v1)."
      >
        <ClientEditForm defaults={defaults} />
      </TitledPanel>

      <TitledPanel
        title="Team assignments"
        description="Assigned team members get full access to this client's workspace (enforced by RLS)."
      >
        <AssignmentManager clientId={clientId} team={team} assignedIds={assignedIds} />
      </TitledPanel>
    </div>
  );
}
