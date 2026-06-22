"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Map, Pencil, Plus } from "lucide-react";

import { milestoneSchema, type MilestoneValues } from "@/lib/schemas";
import { formatDate } from "@/lib/format";
import {
  createMilestoneAction,
  updateMilestoneAction,
  deleteMilestoneAction,
  moveMilestoneAction,
  setMilestoneStatusAction,
} from "@/lib/actions/milestones";
import { Input, Textarea, Select, Switch, EmberButton } from "@/components/redesign/ui";
import { DateField } from "@/components/redesign/ui/date-field";
import { usePanel, EmptyPanel, ConfirmDelete, IconButton, FormDialog, Field, FieldGrid } from "./ui";

export type Milestone = {
  id: string;
  title: string;
  description: string | null;
  phase_label: string | null;
  status: "upcoming" | "in_progress" | "done";
  due_date: string | null;
  visible_to_client: boolean;
  sort_order: number;
};

const STATUSES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
] as const;

/** R3 milestone dialog (re-skinned). RHF + create/update actions verbatim. */
function MilestoneDialog({
  clientId,
  milestone,
  trigger,
}: {
  clientId: string;
  milestone?: Milestone;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, reset, formState: { errors } } = useForm<MilestoneValues>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: {
      title: milestone?.title ?? "",
      description: milestone?.description ?? "",
      phase_label: milestone?.phase_label ?? "",
      status: milestone?.status ?? "upcoming",
      due_date: milestone?.due_date ?? "",
      visible_to_client: milestone?.visible_to_client ?? true,
    },
  });

  async function onSubmit(values: MilestoneValues) {
    setSubmitting(true);
    const res = milestone
      ? await updateMilestoneAction(clientId, milestone.id, values)
      : await createMilestoneAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(milestone ? "Milestone updated." : "Milestone added.");
    setOpen(false);
    if (!milestone) reset();
    router.refresh();
  }

  return (
    <FormDialog
      title={milestone ? "Edit milestone" : "Add milestone"}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      submitting={submitting}
      submitLabel={milestone ? "Save" : "Add milestone"}
      onSubmit={handleSubmit(onSubmit)}
    >
      <Controller control={control} name="title" render={({ field }) => (
        <Field label="Title" error={errors.title?.message}>
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} />
        </Field>
      )} />
      <Controller control={control} name="description" render={({ field }) => (
        <Field label="Description">
          <Textarea value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" rows={3} />
        </Field>
      )} />
      <FieldGrid>
        <Controller control={control} name="phase_label" render={({ field }) => (
          <Field label="Phase label">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="Weeks 1–2" />
          </Field>
        )} />
        <Controller control={control} name="due_date" render={({ field }) => (
          <Field label="Due date">
            <DateField value={field.value ?? ""} onChange={field.onChange} />
          </Field>
        )} />
        <Controller control={control} name="status" render={({ field }) => (
          <Field label="Status">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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

/** R3 staff milestones editor (re-skinned, SOLID cards). All wiring verbatim. */
export function MilestonesEditor({
  clientId,
  milestones,
}: {
  clientId: string;
  milestones: Milestone[];
}) {
  const router = useRouter();
  const { panel, fg1, fg2, fg3, onDark, border } = usePanel();
  const [pending, setPending] = useState(false);

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }

  const ordered = [...milestones].sort((a, b) => a.sort_order - b.sort_order);

  const addBtn = (
    <MilestoneDialog clientId={clientId} trigger={<EmberButton icon={<Plus size={16} />}>Add milestone</EmberButton>} />
  );
  const pillBase: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 999, whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: fg3 }}>
          {ordered.length === 0 ? "No milestones yet." : `${ordered.length} phase${ordered.length === 1 ? "" : "s"}`}
        </p>
        {addBtn}
      </div>

      {ordered.length === 0 ? (
        <EmptyPanel icon={<Map size={22} />} title="No milestones yet" description="Map out the journey the client will see on their Program page." action={addBtn} />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {ordered.map((m) => (
            <li key={m.id} className={panel} style={{ borderRadius: 18, padding: "1rem 1.1rem", display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: fg1 }}>{m.title}</span>
                  {m.phase_label && <span style={{ fontSize: 12, color: fg3 }}>{m.phase_label}</span>}
                  {!m.visible_to_client && <span style={{ ...pillBase, background: "transparent", color: fg3, border: `1px solid ${border}` }}>hidden</span>}
                  {m.due_date && <span style={{ fontSize: 12, color: fg3 }}>due {formatDate(m.due_date)}</span>}
                </div>
                {m.description && <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: fg2 }}>{m.description}</p>}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                <Select value={m.status} onChange={(e) => run(setMilestoneStatusAction(clientId, m.id, e.target.value as Milestone["status"]))} aria-label={`Status for ${m.title}`} style={{ minWidth: "8.5rem" }}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
                <IconButton label="Move up" disabled={pending} onClick={() => run(moveMilestoneAction(clientId, m.id, "up"))}><ChevronUp size={16} /></IconButton>
                <IconButton label="Move down" disabled={pending} onClick={() => run(moveMilestoneAction(clientId, m.id, "down"))}><ChevronDown size={16} /></IconButton>
                <MilestoneDialog clientId={clientId} milestone={m} trigger={<button type="button" aria-label="Edit" className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}><Pencil size={16} /></button>} />
                <ConfirmDelete title="Delete milestone?" description={`“${m.title}” will be permanently removed.`} onConfirm={() => run(deleteMilestoneAction(clientId, m.id))} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
