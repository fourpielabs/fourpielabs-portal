"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Plus, StickyNote } from "lucide-react";

import { meetingNoteSchema, type MeetingNoteValues } from "@/lib/schemas";
import {
  createMeetingNoteAction,
  updateMeetingNoteAction,
  deleteMeetingNoteAction,
  setMeetingNoteVisibilityAction,
} from "@/lib/actions/notes";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { Input, Textarea, Switch, Button } from "@/components/redesign/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { usePanel, EmptyPanel, FormDialog, Field, FieldGrid, ConfirmDelete, IconButton } from "./ui";

export type MeetingNote = {
  id: string;
  title: string;
  meeting_date: string | null;
  body: string | null;
  visible_to_client: boolean;
};

/** R3 meeting-note dialog (re-skinned). create/update wiring preserved verbatim. */
function NoteDialog({
  clientId,
  note,
  trigger,
}: {
  clientId: string;
  note?: MeetingNote;
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
  } = useForm<MeetingNoteValues>({
    resolver: zodResolver(meetingNoteSchema),
    defaultValues: {
      title: note?.title ?? "",
      meeting_date: note?.meeting_date ?? "",
      body: note?.body ?? "",
      visible_to_client: note?.visible_to_client ?? true,
    },
  });

  async function onSubmit(values: MeetingNoteValues) {
    setSubmitting(true);
    const res = note
      ? await updateMeetingNoteAction(clientId, note.id, values)
      : await createMeetingNoteAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(note ? "Note updated." : "Note added.");
    setOpen(false);
    if (!note) reset();
    router.refresh();
  }

  return (
    <FormDialog
      title={note ? "Edit note" : "New meeting note"}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      submitting={submitting}
      submitLabel={note ? "Save" : "Add"}
      onSubmit={handleSubmit(onSubmit)}
    >
      <FieldGrid>
        <Controller control={control} name="title" render={({ field }) => (
          <Field label="Title" error={errors.title?.message}>
            <Input value={field.value} onChange={(_, d) => field.onChange(d.value)} placeholder="Strategy Call" />
          </Field>
        )} />
        <Controller control={control} name="meeting_date" render={({ field }) => (
          <Field label="Date">
            <DatePicker value={field.value ?? ""} onChange={field.onChange} />
          </Field>
        )} />
      </FieldGrid>
      <Controller control={control} name="body" render={({ field }) => (
        <Field label="Notes (markdown)">
          <Textarea value={field.value ?? ""} onChange={(_, d) => field.onChange(d.value)} resize="vertical" rows={6} placeholder="Decisions, actions, next steps…" />
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

/** R3 staff meeting-notes manager (re-skinned, SOLID cards). All wiring verbatim. */
export function NotesManager({
  clientId,
  notes,
}: {
  clientId: string;
  notes: MeetingNote[];
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

  const addBtn = (
    <NoteDialog
      clientId={clientId}
      trigger={<Button appearance="primary" icon={<Plus size={16} />}>New note</Button>}
    />
  );
  const pillBase: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 999, whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: fg3 }}>
          {notes.length === 0 ? "No notes yet." : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
        </p>
        {addBtn}
      </div>

      {notes.length === 0 ? (
        <EmptyPanel
          icon={<StickyNote size={22} />}
          title="No notes yet"
          description="Capture decisions, actions, and next steps from each session."
          action={addBtn}
        />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {notes.map((n) => (
            <li key={n.id} className={panel} style={{ borderRadius: 18, padding: "1rem 1.1rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: fg1 }}>{n.title}</span>
                  {n.meeting_date && <span style={{ fontSize: 12, color: fg3 }}>{formatDate(n.meeting_date)}</span>}
                  {!n.visible_to_client && <span style={{ ...pillBase, background: "transparent", color: fg3, border: `1px solid ${border}` }}>hidden</span>}
                </div>
                <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 4 }}>
                  <IconButton label="Toggle visibility" disabled={pending} onClick={() => run(setMeetingNoteVisibilityAction(clientId, n.id, !n.visible_to_client))}>
                    {n.visible_to_client ? <Eye size={16} /> : <EyeOff size={16} />}
                  </IconButton>
                  <NoteDialog clientId={clientId} note={n} trigger={<button type="button" aria-label="Edit" className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}><Pencil size={16} /></button>} />
                  <ConfirmDelete title="Delete note?" description={`“${n.title}” will be permanently removed.`} onConfirm={() => run(deleteMeetingNoteAction(clientId, n.id))} />
                </div>
              </div>
              {n.body && (
                <div className="rd-prose rd-msg" style={{ paddingTop: "0.6rem" }}>
                  <Markdown>{n.body}</Markdown>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
