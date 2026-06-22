"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Plus } from "lucide-react";

import { competitorSchema, type CompetitorValues } from "@/lib/schemas";
import {
  createCompetitorAction,
  updateCompetitorAction,
  setCompetitorVisibilityAction,
  deleteCompetitorAction,
} from "@/lib/actions/competitors";
import { COMPETITOR_PRIORITIES } from "@/lib/constants";
import { Input, Textarea, Select, Switch, Button, EmberButton } from "@/components/redesign/ui";
import { usePanel, EmptyPanel, ConfirmDelete, IconButton, FormDialog, Field, FieldGrid } from "./ui";

export type Competitor = {
  id: string;
  name_or_handle: string;
  niche: string | null;
  follower_count: number | null;
  avg_views: number | null;
  top_content_format: string | null;
  hook_style: string | null;
  whats_working: string | null;
  gap_notes: string | null;
  adapted_idea: string | null;
  priority: "low" | "medium" | "high";
  visible_to_client: boolean;
};

/** Mode-aware priority pill (mirrors the StatusChip priority palette). */
function PriorityPill({ priority }: { priority: Competitor["priority"] }) {
  const { onDark } = usePanel();
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  const palette: Record<Competitor["priority"], { bg: string; fg: string; bd: string }> = onDark
    ? {
        high: { bg: "rgba(234,88,12,0.18)", fg: "#fdba74", bd: "rgba(234,88,12,0.36)" },
        medium: { bg: "rgba(245,158,11,0.16)", fg: "#fcd34d", bd: "rgba(245,158,11,0.34)" },
        low: { bg: "rgba(255,255,255,0.08)", fg: "#cdc6ba", bd: "rgba(255,255,255,0.16)" },
      }
    : {
        high: { bg: "#fff7ed", fg: "#9a3412", bd: "#fed7aa" },
        medium: { bg: "#fffbeb", fg: "#92400e", bd: "#fde68a" },
        low: { bg: "#f1efe8", fg: "#57534e", bd: "#e2dfd8" },
      };
  const t = palette[priority];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "0.72rem",
        fontWeight: 600,
        lineHeight: 1,
        padding: "0.3rem 0.6rem",
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/** R3 competitor dialog (re-skinned). RHF + create/update wiring preserved verbatim. */
function CompetitorDialog({
  clientId,
  competitor,
  trigger,
}: {
  clientId: string;
  competitor?: Competitor;
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
  } = useForm<CompetitorValues>({
    resolver: zodResolver(competitorSchema),
    defaultValues: {
      name_or_handle: competitor?.name_or_handle ?? "",
      niche: competitor?.niche ?? "",
      follower_count:
        competitor?.follower_count != null ? String(competitor.follower_count) : "",
      avg_views: competitor?.avg_views != null ? String(competitor.avg_views) : "",
      top_content_format: competitor?.top_content_format ?? "",
      hook_style: competitor?.hook_style ?? "",
      whats_working: competitor?.whats_working ?? "",
      gap_notes: competitor?.gap_notes ?? "",
      adapted_idea: competitor?.adapted_idea ?? "",
      priority: competitor?.priority ?? "medium",
      visible_to_client: competitor?.visible_to_client ?? true,
    },
  });

  async function onSubmit(values: CompetitorValues) {
    setSubmitting(true);
    const res = competitor
      ? await updateCompetitorAction(clientId, competitor.id, values)
      : await createCompetitorAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(competitor ? "Competitor updated." : "Competitor added.");
    setOpen(false);
    if (!competitor) reset();
    router.refresh();
  }

  return (
    <FormDialog
      title={competitor ? "Edit competitor" : "Add competitor"}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      submitting={submitting}
      submitLabel={competitor ? "Save" : "Add"}
      onSubmit={handleSubmit(onSubmit)}
    >
      <FieldGrid>
        <Controller control={control} name="name_or_handle" render={({ field }) => (
          <Field label="Name / handle" error={errors.name_or_handle?.message}>
            <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} />
          </Field>
        )} />
        <Controller control={control} name="priority" render={({ field }) => (
          <Field label="Priority">
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {COMPETITOR_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </Field>
        )} />
        <Controller control={control} name="niche" render={({ field }) => (
          <Field label="Niche">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
          </Field>
        )} />
        <Controller control={control} name="top_content_format" render={({ field }) => (
          <Field label="Top content format">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
          </Field>
        )} />
        <Controller control={control} name="follower_count" render={({ field }) => (
          <Field label="Follower count">
            <Input type="number" value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
          </Field>
        )} />
        <Controller control={control} name="avg_views" render={({ field }) => (
          <Field label="Avg views">
            <Input type="number" value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
          </Field>
        )} />
      </FieldGrid>
      <Controller control={control} name="hook_style" render={({ field }) => (
        <Field label="Hook style">
          <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
        </Field>
      )} />
      <Controller control={control} name="whats_working" render={({ field }) => (
        <Field label="What's working">
          <Textarea rows={2} value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" />
        </Field>
      )} />
      <Controller control={control} name="gap_notes" render={({ field }) => (
        <Field label="Gap notes (what they're NOT doing)">
          <Textarea rows={2} value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" />
        </Field>
      )} />
      <Controller control={control} name="adapted_idea" render={({ field }) => (
        <Field label="Adapted idea">
          <Textarea rows={2} value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" />
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

/** R3 staff competitors manager (re-skinned, SOLID cards). All wiring verbatim. */
export function CompetitorsManager({
  clientId,
  competitors,
}: {
  clientId: string;
  competitors: Competitor[];
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

  const addBtn = (
    <CompetitorDialog
      clientId={clientId}
      trigger={<Button appearance="primary" icon={<Plus size={16} />}>Add competitor</Button>}
    />
  );

  const microLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: fg3,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: fg3 }}>
          {competitors.length === 0 ? "No competitors tracked yet." : `${competitors.length} tracked`}
        </p>
        {addBtn}
      </div>

      {competitors.length === 0 ? (
        <EmptyPanel
          icon={<Eye size={22} />}
          title="No competitors tracked yet"
          description="Track competitors — what's working, the gaps, and ideas to adapt."
          action={addBtn}
        />
      ) : (
        <div className="rd-competitors-grid">
          {competitors.map((c) => (
            <div key={c.id} className={panel} style={{ borderRadius: 18, padding: "1.1rem 1.2rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: fg1 }}>{c.name_or_handle}</span>
                    <PriorityPill priority={c.priority} />
                    {!c.visible_to_client && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 999, background: "transparent", color: fg3, border: `1px solid ${border}`, whiteSpace: "nowrap" }}>hidden</span>
                    )}
                  </div>
                  {c.niche && <div style={{ marginTop: 2, fontSize: 12, color: fg3 }}>{c.niche}</div>}
                </div>
                <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 2 }}>
                  <IconButton
                    label="Toggle visibility"
                    disabled={pending}
                    onClick={() => run(setCompetitorVisibilityAction(clientId, c.id, !c.visible_to_client))}
                  >
                    {c.visible_to_client ? <Eye size={16} /> : <EyeOff size={16} />}
                  </IconButton>
                  <CompetitorDialog
                    clientId={clientId}
                    competitor={c}
                    trigger={
                      <button type="button" aria-label="Edit" className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}>
                        <Pencil size={16} />
                      </button>
                    }
                  />
                  <ConfirmDelete
                    title="Delete competitor?"
                    description={`“${c.name_or_handle}” will be removed.`}
                    onConfirm={() => run(deleteCompetitorAction(clientId, c.id))}
                  />
                </div>
              </div>

              {(c.follower_count != null || c.avg_views != null) && (
                <div style={{ marginTop: 12, display: "flex", gap: 24 }}>
                  {c.follower_count != null && (
                    <div>
                      <div style={microLabel}>Followers</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: fg1, fontVariantNumeric: "tabular-nums" }}>{c.follower_count.toLocaleString()}</div>
                    </div>
                  )}
                  {c.avg_views != null && (
                    <div>
                      <div style={microLabel}>Avg views</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: fg1, fontVariantNumeric: "tabular-nums" }}>{c.avg_views.toLocaleString()}</div>
                    </div>
                  )}
                </div>
              )}

              {(c.top_content_format || c.hook_style) && (
                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.8rem" }}>
                  {c.top_content_format && (
                    <div>
                      <div style={microLabel}>Top format</div>
                      <div style={{ color: fg2 }}>{c.top_content_format}</div>
                    </div>
                  )}
                  {c.hook_style && (
                    <div>
                      <div style={microLabel}>Hook style</div>
                      <div style={{ color: fg2 }}>{c.hook_style}</div>
                    </div>
                  )}
                </div>
              )}

              {c.whats_working && (
                <p style={{ margin: "12px 0 0", fontSize: "0.8rem", color: fg2 }}>
                  <span style={{ color: fg3 }}>What&apos;s working: </span>
                  {c.whats_working}
                </p>
              )}
              {c.gap_notes && (
                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: fg2 }}>
                  <span style={{ color: fg3 }}>The gap: </span>
                  {c.gap_notes}
                </p>
              )}
              {c.adapted_idea && (
                <div style={{ marginTop: 12, borderRadius: 12, padding: "0.7rem 0.8rem", background: onDark ? "rgba(245,158,11,0.14)" : "#fef3c7" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: onDark ? "#fcd34d" : "#b45309" }}>Our play</div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: onDark ? "#f5e6c8" : "#7c2d12" }}>{c.adapted_idea}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`.rd-competitors-grid{display:grid;gap:0.7rem;grid-template-columns:1fr;} @media(min-width:680px){.rd-competitors-grid{grid-template-columns:1fr 1fr;}}`}</style>
    </div>
  );
}
