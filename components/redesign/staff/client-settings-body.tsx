"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { clientUpdateSchema, type ClientUpdateValues } from "@/lib/schemas";
import { updateClientAction } from "@/lib/actions/clients";
import { INDUSTRIES, PROGRAMS, CLIENT_STATUSES } from "@/lib/constants";
import { Input, Textarea, Select, Button, EmberButton } from "@/components/redesign/ui";
import { DateField } from "@/components/redesign/ui/date-field";
import { TitledPanel, Field, FieldGrid, usePanel } from "./ui";
import { AssignmentManager, type TeamMember } from "./assignment-manager";
import { ClientPermissionsPanel } from "./client-permissions-panel";
import { type ClientFieldPermissions } from "@/lib/client-fields";

// Keep ClientUpdateValues importable from this module for one import shape.
export type { ClientUpdateValues } from "@/lib/schemas";

/** R3 client-details edit form (re-skinned, SOLID). RHF + updateClientAction wiring verbatim.
 *  Per-type: the Program assignment is shown ONLY for program clients (project clients carry a
 *  neutral placeholder program that's never read — keep it in form state, hidden from the UI). */
export function ClientEditForm({ defaults, isProject = false }: { defaults: ClientUpdateValues; isProject?: boolean }) {
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
        {/* Program assignment — program clients only (project clients have no program tier). */}
        {!isProject && (
          <Controller control={control} name="program" render={({ field }) => (
            <Field label="Program">
              <Select value={field.value} onChange={(e) => field.onChange(e.target.value)} style={{ width: "100%" }}>
                {PROGRAMS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
          )} />
        )}
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
  isProject = false,
  team,
  assignedIds,
  fieldPermissions,
}: {
  defaults: ClientUpdateValues;
  clientId: string;
  isProject?: boolean;
  team: TeamMember[];
  assignedIds: string[];
  fieldPermissions: ClientFieldPermissions;
}) {
  const base = `/clients/${clientId}`;
  // type-specific workspace entry points (presentation only — links to existing tabs).
  const links = isProject
    ? [
        { href: `${base}/projects`, label: "Projects", hint: "Manage this client's project board" },
        { href: `${base}/metrics`, label: "Results & metrics", hint: "Define KPIs + targets that populate their Results page" },
        { href: `${base}/deliverables`, label: "Deliverables", hint: "Drafts, links, and files" },
      ]
    : [
        { href: `${base}/program`, label: "Program & milestones", hint: "Roadmap and program delivery" },
        { href: `${base}/metrics`, label: "Performance metrics", hint: "Program KPIs + monthly entries" },
        { href: `${base}/content`, label: "Content calendar", hint: "Scheduled content" },
      ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <TitledPanel
        title={isProject ? "Project workspace" : "Program workspace"}
        description={isProject
          ? "This is a project client — jump into their projects, Results metrics, or deliverables."
          : "This is a program client — jump into their program roadmap, performance metrics, or content."}
      >
        <div className="rd-cs-links">
          {links.map((l) => (
            <Button key={l.href} as="a" href={l.href} appearance="outline" style={{ height: "auto", justifyContent: "flex-start", padding: "0.7rem 0.9rem", textAlign: "left" }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                <span style={{ fontWeight: 600 }}>{l.label}</span>
                <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 400 }}>{l.hint}</span>
              </span>
            </Button>
          ))}
        </div>
      </TitledPanel>

      <TitledPanel
        title="Client details"
        description={isProject
          ? "Core client info and status. Setting status to Paused or Churned is the soft-delete (no hard delete in v1)."
          : "Core client info, program, and status. Setting status to Paused or Churned is the soft-delete (no hard delete in v1)."}
      >
        <ClientEditForm defaults={defaults} isProject={isProject} />
      </TitledPanel>

      <TitledPanel
        title="Team assignments"
        description="Assigned team members get full access to this client's workspace (enforced by RLS)."
      >
        <AssignmentManager clientId={clientId} team={team} assignedIds={assignedIds} />
      </TitledPanel>

      <TitledPanel
        title="Client edit permissions"
        description="Grant this client permission to edit a few safe fields on their own profile (deny-by-default). Locked fields like status and approvals are never editable by clients."
      >
        <ClientPermissionsPanel clientId={clientId} permissions={fieldPermissions} />
      </TitledPanel>

      <style>{`
        .rd-cs-links{display:grid;gap:0.6rem;grid-template-columns:1fr;}
        @media(min-width:640px){.rd-cs-links{grid-template-columns:1fr 1fr 1fr;}}
      `}</style>
    </div>
  );
}
