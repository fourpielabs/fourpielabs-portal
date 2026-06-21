"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, GaugeCircle, GripVertical, Pencil, Plus } from "lucide-react";

import { metricDefinitionSchema, type MetricDefinitionValues } from "@/lib/schemas";
import {
  createMetricDefinitionAction,
  updateMetricDefinitionAction,
  setMetricDefinitionActiveAction,
  moveMetricDefinitionAction,
} from "@/lib/actions/metrics";
import { METRIC_UNITS, labelOf } from "@/lib/constants";
import { Input, Select, Switch, Button } from "@/components/redesign/ui";
import { usePanel, EmptyPanel, IconButton, FormDialog, Field, FieldGrid } from "./ui";

// Re-export the row type from the original module so callers keep one import shape.
export type { MetricDef } from "@/components/metrics/definitions-manager";
import type { MetricDef } from "@/components/metrics/definitions-manager";

function slugifyKey(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** R3 metric-definition dialog (re-skinned). RHF + create/update wiring preserved verbatim. */
function DefDialog({
  clientId,
  def,
  trigger,
}: {
  clientId: string;
  def?: MetricDef;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, dirtyFields },
  } = useForm<MetricDefinitionValues>({
    resolver: zodResolver(metricDefinitionSchema),
    defaultValues: {
      label: def?.label ?? "",
      key: def?.key ?? "",
      unit: def?.unit ?? "number",
      is_active: def?.is_active ?? true,
      target: def?.target ?? null,
    },
  });

  async function onSubmit(values: MetricDefinitionValues) {
    setSubmitting(true);
    const res = def
      ? await updateMetricDefinitionAction(clientId, def.id, values)
      : await createMetricDefinitionAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(def ? "Definition updated." : "Definition added.");
    setOpen(false);
    if (!def) reset();
    router.refresh();
  }

  return (
    <FormDialog
      title={def ? "Edit metric" : "Add metric"}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      submitting={submitting}
      submitLabel={def ? "Save" : "Add"}
      onSubmit={handleSubmit(onSubmit)}
    >
      <Controller control={control} name="label" render={({ field }) => (
        <Field label="Label" error={errors.label?.message}>
          <Input
            value={field.value}
            onChange={(_, d) => {
              field.onChange(d.value);
              if (!def && !dirtyFields.key) setValue("key", slugifyKey(d.value));
            }}
          />
        </Field>
      )} />
      <FieldGrid>
        <Controller control={control} name="key" render={({ field }) => (
          <Field label="Key" error={errors.key?.message}>
            <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} placeholder="leads" />
          </Field>
        )} />
        <Controller control={control} name="unit" render={({ field }) => (
          <Field label="Unit">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {METRIC_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </Select>
          </Field>
        )} />
      </FieldGrid>
      <Controller control={control} name="target" render={({ field }) => (
        <Field label="Target (optional) — shown to the client as a pacing bar">
          <Input type="number" value={field.value == null ? "" : String(field.value)} onChange={(_, d) => field.onChange(d.value === "" ? null : Number(d.value))} placeholder="e.g. 100" />
        </Field>
      )} />
      <Controller control={control} name="is_active" render={({ field }) => (
        <Field label="Active">
          <div style={{ display: "flex", height: 32, alignItems: "center" }}>
            <Switch checked={field.value} onChange={(_, d) => field.onChange(d.checked)} />
          </div>
        </Field>
      )} />
    </FormDialog>
  );
}

/** R3 staff metric-definitions manager (re-skinned, SOLID rows). All wiring verbatim. */
export function DefinitionsManager({
  clientId,
  definitions,
}: {
  clientId: string;
  definitions: MetricDef[];
}) {
  const router = useRouter();
  const { panel, fg1, fg3, onDark, border } = usePanel();
  const [pending, setPending] = useState(false);

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }

  const ordered = [...definitions].sort((a, b) => a.sort_order - b.sort_order);

  const addBtn = (
    <DefDialog
      clientId={clientId}
      trigger={<Button appearance="primary" icon={<Plus size={16} />}>Add metric</Button>}
    />
  );

  const pillBase: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 999, whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: fg3 }}>
          {ordered.length === 0 ? "No metrics defined yet." : `${ordered.length} defined`}
        </p>
        {addBtn}
      </div>

      {ordered.length === 0 ? (
        <EmptyPanel
          icon={<GaugeCircle size={22} />}
          title="No metrics defined yet"
          description="Define the metrics you'll track for this client — leads, revenue, rankings, and more."
          action={addBtn}
        />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {ordered.map((d) => (
            <li
              key={d.id}
              className={panel}
              style={{ borderRadius: 18, padding: "0.9rem 1.1rem", display: "flex", alignItems: "center", gap: 10, opacity: d.is_active ? 1 : 0.6 }}
            >
              <GripVertical size={16} aria-hidden style={{ flexShrink: 0, cursor: "grab", color: fg3 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: fg1 }}>{d.label}</span>
                  <span style={{ ...pillBase, background: onDark ? "rgba(255,255,255,0.08)" : "#f1efe8", color: fg3 }}>{labelOf(METRIC_UNITS, d.unit)}</span>
                  {!d.is_active && <span style={{ ...pillBase, background: "transparent", color: fg3, border: `1px solid ${border}` }}>inactive</span>}
                </div>
                <code style={{ fontSize: 12, color: fg3 }}>{d.key}</code>
              </div>
              <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 2 }}>
                <IconButton label="Move up" disabled={pending} onClick={() => run(moveMetricDefinitionAction(clientId, d.id, "up"))}>
                  <ChevronUp size={16} />
                </IconButton>
                <IconButton label="Move down" disabled={pending} onClick={() => run(moveMetricDefinitionAction(clientId, d.id, "down"))}>
                  <ChevronDown size={16} />
                </IconButton>
                <DefDialog
                  clientId={clientId}
                  def={d}
                  trigger={
                    <button type="button" aria-label="Edit" className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}>
                      <Pencil size={16} />
                    </button>
                  }
                />
                <Button
                  appearance="outline"
                  size="small"
                  disabled={pending}
                  onClick={() => run(setMetricDefinitionActiveAction(clientId, d.id, !d.is_active))}
                >
                  {d.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
