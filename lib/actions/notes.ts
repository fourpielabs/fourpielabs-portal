"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { meetingNoteSchema, type MeetingNoteValues } from "@/lib/schemas";

type Result = { ok: true } | { ok: false; error: string };
const txt = (v: string | undefined | null) => (v && v.length > 0 ? v : null);
const revalidate = (clientId: string) =>
  revalidatePath(`/clients/${clientId}/notes`);

function row(v: MeetingNoteValues) {
  return {
    title: v.title,
    meeting_date: txt(v.meeting_date),
    body: txt(v.body),
    visible_to_client: v.visible_to_client,
  };
}

export async function createMeetingNoteAction(
  clientId: string,
  values: MeetingNoteValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = meetingNoteSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meeting_notes")
    .insert({ client_id: clientId, author_id: me.id, ...row(parsed.data) })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "meeting_note.created",
    entity: "meeting_note",
    entityId: data.id,
    clientId,
    metadata: { title: parsed.data.title },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function updateMeetingNoteAction(
  clientId: string,
  id: string,
  values: MeetingNoteValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = meetingNoteSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_notes")
    .update(row(parsed.data))
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "meeting_note.updated",
    entity: "meeting_note",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function setMeetingNoteVisibilityAction(
  clientId: string,
  id: string,
  visible: boolean,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_notes")
    .update({ visible_to_client: visible })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "meeting_note.visibility_changed",
    entity: "meeting_note",
    entityId: id,
    clientId,
    metadata: { visible_to_client: visible },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteMeetingNoteAction(
  clientId: string,
  id: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_notes")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "meeting_note.deleted",
    entity: "meeting_note",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}
