import { createAdminClient } from "@/lib/supabase/admin";

export type AuditInput = {
  actorId: string | null;
  action: string; // e.g. "client.created", "user.deactivated"
  entity?: string | null;
  entityId?: string | null;
  clientId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Insert an audit_log row through the SERVICE-ROLE client.
 *
 * audit_log has admin-only SELECT and NO insert policy, so writes must bypass
 * RLS via the service role (spec §4: "insert-only from server actions"). Call
 * this from every mutation server action.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_id: input.actorId,
    action: input.action,
    entity: input.entity ?? null,
    entity_id: input.entityId ?? null,
    client_id: input.clientId ?? null,
    metadata: input.metadata ?? {},
  });
  // Audit failures should never break the user's action; surface in server logs.
  if (error) console.error("audit_log insert failed:", error.message, input);
}
