import { createAdminClient } from "@/lib/supabase/admin";
import { clientUserIds, staffUserIds } from "@/lib/notifications";

/**
 * A client's "circle" — the only people a task can be assigned to: the client's
 * own portal users plus the staff who work that client (assigned team + admins).
 * Reuses the 4b recipient helpers. Server-only (createAdminClient); used by the
 * task pages to populate the assignee picker and by the staff actions to validate
 * an assignee before a write. The client RPC re-validates the same set server-side.
 */
export type TaskMember = { id: string; name: string; role: "client" | "team" | "admin" };

/** A Phase-4 subtask: a lightweight checklist item under a parent task. Read visibility
 *  follows the parent (RLS); both roles write (client via RPC, staff direct). */
export type TaskChecklistItem = {
  id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
};

export async function getAssignableMembers(clientId: string): Promise<TaskMember[]> {
  const admin = createAdminClient();
  // Query 1: who's assigned to this client (the only part that needs the join).
  const { data: assigns } = await admin
    .from("client_assignments")
    .select("user_id")
    .eq("client_id", clientId);
  const assignedIds = (assigns ?? []).map((a) => a.user_id as string);

  // Query 2: the whole circle + names in ONE round-trip — the client's own users
  // (client_id) ∪ all admins ∪ the assigned team. (Was 4 round-trips: clientUserIds +
  // staffUserIds[×2] + a names lookup.)
  const orParts = [`client_id.eq.${clientId}`, `role.eq.admin`];
  if (assignedIds.length) orParts.push(`id.in.(${assignedIds.join(",")})`);
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("is_active", true)
    .or(orParts.join(","));

  return (data ?? [])
    .map((p) => ({
      id: p.id as string,
      name: (p.full_name as string) ?? (p.email as string) ?? "Unknown",
      role: p.role as TaskMember["role"],
    }))
    .sort((a, b) => {
      // clients first (the people work is "owed to/by"), then staff, by name
      const ac = a.role === "client" ? 0 : 1;
      const bc = b.role === "client" ? 0 : 1;
      return ac - bc || a.name.localeCompare(b.name);
    });
}

/** Whether `userId` is in `clientId`'s circle (defense-in-depth for staff writes). */
export async function isCircleMember(clientId: string, userId: string): Promise<boolean> {
  const [clients, staff] = await Promise.all([clientUserIds(clientId), staffUserIds(clientId)]);
  return new Set([...clients, ...staff]).has(userId);
}
