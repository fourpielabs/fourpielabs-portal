"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import {
  callTypeSchema,
  callRecordingSchema,
  type CallTypeValues,
  type CallRecordingValues,
} from "@/lib/schemas";

type Result = { ok: true } | { ok: false; error: string };
const txt = (v: string | undefined | null) => (v && v.length > 0 ? v : null);
const revalidate = (clientId: string) =>
  revalidatePath(`/clients/${clientId}/calls`);

// ---- call types -------------------------------------------------------------

export async function createCallTypeAction(
  clientId: string,
  values: CallTypeValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = callTypeSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("call_types")
    .select("sort_order")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("call_types")
    .insert({
      client_id: clientId,
      name: v.name,
      duration_label: txt(v.duration_label),
      frequency_label: txt(v.frequency_label),
      booking_url: txt(v.booking_url),
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "call_type.created",
    entity: "call_type",
    entityId: data.id,
    clientId,
    metadata: { name: v.name },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function updateCallTypeAction(
  clientId: string,
  id: string,
  values: CallTypeValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = callTypeSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("call_types")
    .update({
      name: v.name,
      duration_label: txt(v.duration_label),
      frequency_label: txt(v.frequency_label),
      booking_url: txt(v.booking_url),
    })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "call_type.updated",
    entity: "call_type",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteCallTypeAction(
  clientId: string,
  id: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("call_types")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "call_type.deleted",
    entity: "call_type",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

// ---- call recordings --------------------------------------------------------

function recRow(v: CallRecordingValues) {
  return {
    call_date: txt(v.call_date),
    call_type: txt(v.call_type),
    recording_url: txt(v.recording_url),
    key_topic: txt(v.key_topic),
    visible_to_client: v.visible_to_client,
  };
}

export async function createCallRecordingAction(
  clientId: string,
  values: CallRecordingValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = callRecordingSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("call_recordings")
    .insert({ client_id: clientId, created_by: me.id, ...recRow(parsed.data) })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "call_recording.created",
    entity: "call_recording",
    entityId: data.id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function updateCallRecordingAction(
  clientId: string,
  id: string,
  values: CallRecordingValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = callRecordingSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("call_recordings")
    .update(recRow(parsed.data))
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "call_recording.updated",
    entity: "call_recording",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function setCallRecordingVisibilityAction(
  clientId: string,
  id: string,
  visible: boolean,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("call_recordings")
    .update({ visible_to_client: visible })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "call_recording.visibility_changed",
    entity: "call_recording",
    entityId: id,
    clientId,
    metadata: { visible_to_client: visible },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteCallRecordingAction(
  clientId: string,
  id: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("call_recordings")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "call_recording.deleted",
    entity: "call_recording",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}
