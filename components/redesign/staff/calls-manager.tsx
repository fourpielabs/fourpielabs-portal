"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, ExternalLink, Pencil, Plus, Phone, Video } from "lucide-react";

import { formatDate } from "@/lib/format";
import {
  callTypeSchema,
  callRecordingSchema,
  type CallTypeValues,
  type CallRecordingValues,
} from "@/lib/schemas";
import {
  createCallTypeAction,
  updateCallTypeAction,
  deleteCallTypeAction,
  createCallRecordingAction,
  updateCallRecordingAction,
  deleteCallRecordingAction,
  setCallRecordingVisibilityAction,
} from "@/lib/actions/calls";
import { Input, Switch, EmberButton, Button } from "@/components/redesign/ui";
import { DateField } from "@/components/redesign/ui/date-field";
import { usePanel, EmptyPanel, ConfirmDelete, IconButton, FormDialog, Field, FieldGrid } from "./ui";

export type CallType = {
  id: string;
  name: string;
  duration_label: string | null;
  frequency_label: string | null;
  booking_url: string | null;
};
export type CallRecording = {
  id: string;
  call_date: string | null;
  call_type: string | null;
  recording_url: string | null;
  key_topic: string | null;
  visible_to_client: boolean;
};

function useRun() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }
  return { pending, run };
}

function CallTypeDialog({
  clientId,
  callType,
  trigger,
}: {
  clientId: string;
  callType?: CallType;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CallTypeValues>({
    resolver: zodResolver(callTypeSchema),
    defaultValues: {
      name: callType?.name ?? "",
      duration_label: callType?.duration_label ?? "",
      frequency_label: callType?.frequency_label ?? "",
      booking_url: callType?.booking_url ?? "",
    },
  });

  async function onSubmit(values: CallTypeValues) {
    setSubmitting(true);
    const res = callType
      ? await updateCallTypeAction(clientId, callType.id, values)
      : await createCallTypeAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(callType ? "Updated." : "Added.");
    setOpen(false);
    if (!callType) reset();
    router.refresh();
  }

  return (
    <FormDialog
      title={callType ? "Edit call type" : "Add call type"}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      submitting={submitting}
      submitLabel={callType ? "Save" : "Add"}
      onSubmit={handleSubmit(onSubmit)}
    >
      <Controller control={control} name="name" render={({ field }) => (
        <Field label="Name" error={errors.name?.message}>
          <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} placeholder="Monthly Review Call" />
        </Field>
      )} />
      <FieldGrid>
        <Controller control={control} name="duration_label" render={({ field }) => (
          <Field label="Duration">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="45 min" />
          </Field>
        )} />
        <Controller control={control} name="frequency_label" render={({ field }) => (
          <Field label="Frequency">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="Monthly" />
          </Field>
        )} />
      </FieldGrid>
      <Controller control={control} name="booking_url" render={({ field }) => (
        <Field label="Booking URL" error={errors.booking_url?.message}>
          <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} placeholder="https://calendly.com/…" />
        </Field>
      )} />
    </FormDialog>
  );
}

function RecordingDialog({
  clientId,
  recording,
  callTypeNames,
  trigger,
}: {
  clientId: string;
  recording?: CallRecording;
  callTypeNames: string[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CallRecordingValues>({
    resolver: zodResolver(callRecordingSchema),
    defaultValues: {
      call_date: recording?.call_date ?? "",
      call_type: recording?.call_type ?? (callTypeNames[0] ?? ""),
      recording_url: recording?.recording_url ?? "",
      key_topic: recording?.key_topic ?? "",
      visible_to_client: recording?.visible_to_client ?? true,
    },
  });

  async function onSubmit(values: CallRecordingValues) {
    setSubmitting(true);
    const res = recording
      ? await updateCallRecordingAction(clientId, recording.id, values)
      : await createCallRecordingAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(recording ? "Updated." : "Logged.");
    setOpen(false);
    if (!recording) reset();
    router.refresh();
  }

  return (
    <FormDialog
      title={recording ? "Edit recording" : "Log a recording"}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      submitting={submitting}
      submitLabel={recording ? "Save" : "Log"}
      onSubmit={handleSubmit(onSubmit)}
    >
      <FieldGrid>
        <Controller control={control} name="call_date" render={({ field }) => (
          <Field label="Date">
            <DateField value={field.value ?? ""} onChange={field.onChange} />
          </Field>
        )} />
        <Controller control={control} name="call_type" render={({ field }) => (
          <Field label="Call type">
            <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} list="call-type-names" />
            <datalist id="call-type-names">
              {callTypeNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
        )} />
      </FieldGrid>
      <Controller control={control} name="recording_url" render={({ field }) => (
        <Field label="Recording URL" error={errors.recording_url?.message}>
          <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
        </Field>
      )} />
      <Controller control={control} name="key_topic" render={({ field }) => (
        <Field label="Key topic">
          <Input value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} />
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

/** Compact SOLID section header (title + description left, action right). */
function PanelHead({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action: React.ReactNode }) {
  const { fg1, fg3, onDark } = usePanel();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{ display: "inline-flex", flexShrink: 0, width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 14, background: onDark ? "rgba(245,158,11,0.16)" : "#fef3c7", color: "#b45309" }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: fg1 }}>{title}</h3>
          <p style={{ margin: 0, fontSize: 12, color: fg3 }}>{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

/** R3 staff calls manager (re-skinned, SOLID panels). All wiring verbatim. */
export function CallsManager({
  clientId,
  callTypes,
  recordings,
}: {
  clientId: string;
  callTypes: CallType[];
  recordings: CallRecording[];
}) {
  const { pending, run } = useRun();
  const { panel, fg1, fg3, onDark, border } = usePanel();
  const callTypeNames = callTypes.map((c) => c.name);

  const editBtn = (label: string) => (
    <button type="button" aria-label={label} className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}>
      <Pencil size={16} />
    </button>
  );
  const card: React.CSSProperties = { borderRadius: 18, padding: "1.2rem", display: "flex", flexDirection: "column", gap: "1rem" };
  const pillBase: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 999, whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <section className={panel} style={card}>
        <PanelHead
          icon={<Phone size={20} />}
          title="Bookable calls"
          description="Call types with booking links."
          action={
            <CallTypeDialog
              clientId={clientId}
              trigger={<EmberButton icon={<Plus size={16} />}>Add</EmberButton>}
            />
          }
        />
        {callTypes.length === 0 ? (
          <EmptyPanel icon={<Phone size={22} />} title="No call types yet" description="Add the recurring calls this client can book." />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
            {callTypes.map((c, idx) => (
              <li key={c.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "0.85rem 0", borderTop: idx === 0 ? "none" : `1px solid ${border}` }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, color: fg1 }}>{c.name}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12, color: fg3, paddingTop: 2 }}>
                    {c.duration_label && <span>{c.duration_label}</span>}
                    {c.frequency_label && <span>· {c.frequency_label}</span>}
                    {c.booking_url && (
                      <Button as="a" href={c.booking_url} target="_blank" rel="noreferrer" appearance="subtle" size="small" icon={<ExternalLink size={14} />}>Book</Button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 2 }}>
                  <CallTypeDialog clientId={clientId} callType={c} trigger={editBtn("Edit")} />
                  <ConfirmDelete title="Delete call type?" description={`“${c.name}” will be permanently removed.`} onConfirm={() => run(deleteCallTypeAction(clientId, c.id))} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel} style={card}>
        <PanelHead
          icon={<Video size={20} />}
          title="Recordings"
          description="Past sessions."
          action={
            <RecordingDialog
              clientId={clientId}
              callTypeNames={callTypeNames}
              trigger={<EmberButton icon={<Plus size={16} />}>Log</EmberButton>}
            />
          }
        />
        {recordings.length === 0 ? (
          <EmptyPanel icon={<Video size={22} />} title="No recordings logged yet" description="Log past sessions so the client can revisit them." />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
            {recordings.map((r, idx) => (
              <li key={r.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "0.85rem 0", borderTop: idx === 0 ? "none" : `1px solid ${border}` }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: fg1 }}>{r.call_type ?? "Call"}</span>
                    {r.call_date && <span style={{ fontSize: 12, color: fg3 }}>{formatDate(r.call_date)}</span>}
                    {!r.visible_to_client && <span style={{ ...pillBase, background: "transparent", color: fg3, border: `1px solid ${border}` }}>hidden</span>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12, color: fg3, paddingTop: 2 }}>
                    {r.key_topic && <span>{r.key_topic}</span>}
                    {r.recording_url && (
                      <Button as="a" href={r.recording_url} target="_blank" rel="noreferrer" appearance="subtle" size="small" icon={<ExternalLink size={14} />}>Watch</Button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 2 }}>
                  <IconButton label="Toggle visibility" disabled={pending} onClick={() => run(setCallRecordingVisibilityAction(clientId, r.id, !r.visible_to_client))}>
                    {r.visible_to_client ? <Eye size={16} /> : <EyeOff size={16} />}
                  </IconButton>
                  <RecordingDialog clientId={clientId} recording={r} callTypeNames={callTypeNames} trigger={editBtn("Edit")} />
                  <ConfirmDelete title="Delete recording?" description={`This recording will be permanently removed.`} onConfirm={() => run(deleteCallRecordingAction(clientId, r.id))} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
