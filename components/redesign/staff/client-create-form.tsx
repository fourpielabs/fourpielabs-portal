"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { clientCreateSchema, type ClientCreateValues } from "@/lib/schemas";
import { createClientAction } from "@/lib/actions/clients";
import { INDUSTRIES, PROGRAMS, CLIENT_STATUSES, CLIENT_TYPES } from "@/lib/constants";
import { Input, Select, EmberButton, Button } from "@/components/redesign/ui";
import { DateField } from "@/components/redesign/ui/date-field";
import { TitledPanel, Field, FieldGrid, usePanel } from "./ui";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * R3 new-client form (re-skinned, SOLID titled panels). The CONDITIONAL behavior is
 * preserved verbatim: client_type is the FIRST decision and the rest of the form reacts
 * to it — `program` shows the Program tier select; `project` hides it. All RHF state, the
 * slug auto-derive, and the createClientAction wiring (every toast branch) are unchanged.
 */
export function ClientCreateForm() {
  const router = useRouter();
  const { fg3 } = usePanel();
  const [submitting, setSubmitting] = useState(false);
  const {
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { dirtyFields },
  } = useForm<ClientCreateValues>({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: {
      name: "",
      slug: "",
      industry: "painting_contractor",
      program: "pipeline",
      client_type: "program",
      status: "onboarding",
      website_url: "",
      start_date: "",
      client_email: "",
      client_full_name: "",
    },
  });

  const clientType = watch("client_type");

  async function onSubmit(values: ClientCreateValues) {
    setSubmitting(true);
    const res = await createClientAction(values);
    if (!res.ok) {
      setSubmitting(false);
      toast.error("Couldn't create client", { description: res.error });
      return;
    }
    if (res.data?.inviteError) {
      // Client row was created, but the welcome email failed — surface it so the
      // admin can retry from the Users page rather than silently losing the user.
      toast.warning("Client created, but the account email didn't send", {
        description: res.data.inviteError,
      });
    } else if (values.client_email) {
      toast.success("Client created — welcome email sent to the account.");
    } else {
      toast.success(
        values.client_type === "project"
          ? "Project client created."
          : "Client created — onboarding, roadmap & metrics seeded.",
      );
    }
    router.push(`/clients/${res.data!.id}/settings`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Client type is the FIRST decision — the rest of the form reacts to it. */}
      <TitledPanel
        title="Client type"
        description={
          clientType === "project"
            ? "Projects board — no program tier, 90-day roadmap, or metrics. The client manages their own scoped projects."
            : "Program engagement — seeds the onboarding checklist, 90-day roadmap & program metrics."
        }
      >
        <Controller control={control} name="client_type" render={({ field }) => (
          <Field label="Client type">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {CLIENT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
        )} />
      </TitledPanel>

      <TitledPanel title="Client details" description="The business this engagement is for.">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Controller control={control} name="name" render={({ field, fieldState }) => (
            <Field label="Business name" error={fieldState.error?.message}>
              <Input
                value={field.value}
                onChange={(_, d) => {
                  field.onChange(d.value);
                  if (!dirtyFields.slug) setValue("slug", slugify(d.value));
                }}
              />
            </Field>
          )} />

          <Controller control={control} name="slug" render={({ field, fieldState }) => (
            <Field label="Slug" error={fieldState.error?.message}>
              <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} placeholder="premier-painting" />
            </Field>
          )} />

          <FieldGrid>
            <Controller control={control} name="industry" render={({ field }) => (
              <Field label="Industry">
                <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                  {INDUSTRIES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
            )} />

            {clientType === "program" && (
              <Controller control={control} name="program" render={({ field }) => (
                <Field label="Program">
                  <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                    {PROGRAMS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </Field>
              )} />
            )}

            <Controller control={control} name="status" render={({ field }) => (
              <Field label="Status">
                <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                  {CLIENT_STATUSES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
            )} />

            <Controller control={control} name="start_date" render={({ field }) => (
              <Field label="Start date">
                <DateField value={field.value ?? ""} onChange={field.onChange} />
              </Field>
            )} />
          </FieldGrid>

          <Controller control={control} name="website_url" render={({ field, fieldState }) => (
            <Field label="Website" error={fieldState.error?.message}>
              <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="https://example.com" />
            </Field>
          )} />
        </div>
      </TitledPanel>

      <TitledPanel
        title="Client account"
        description="Optional. Enter the client's email to create their portal login now — we'll email a welcome message with a secure set-password link. No password is generated. Leave blank to add them later."
      >
        <FieldGrid>
          <Controller control={control} name="client_full_name" render={({ field }) => (
            <Field label="Contact name · optional">
              <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="Casey Jones" />
            </Field>
          )} />
          <Controller control={control} name="client_email" render={({ field, fieldState }) => (
            <Field label="Contact email · optional" error={fieldState.error?.message}>
              <Input type="email" value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="casey@premierpainting.com" />
            </Field>
          )} />
        </FieldGrid>
      </TitledPanel>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <EmberButton type="submit" loading={submitting}>
          {submitting ? "Creating…" : "Create client"}
        </EmberButton>
        <Button type="button" appearance="subtle" onClick={() => router.back()} disabled={submitting} style={{ color: fg3 }}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
