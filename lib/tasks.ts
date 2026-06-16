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

export async function getAssignableMembers(clientId: string): Promise<TaskMember[]> {
  const [clients, staff] = await Promise.all([clientUserIds(clientId), staffUserIds(clientId)]);
  const ids = [...new Set([...clients, ...staff])];
  if (ids.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .in("id", ids);
  const clientSet = new Set(clients);
  return (data ?? [])
    .map((p) => ({
      id: p.id as string,
      name: (p.full_name as string) ?? (p.email as string) ?? "Unknown",
      role: p.role as TaskMember["role"],
    }))
    .sort((a, b) => {
      // clients first (the people work is "owed to/by"), then staff, by name
      const ac = clientSet.has(a.id) ? 0 : 1;
      const bc = clientSet.has(b.id) ? 0 : 1;
      return ac - bc || a.name.localeCompare(b.name);
    });
}

/** Whether `userId` is in `clientId`'s circle (defense-in-depth for staff writes). */
export async function isCircleMember(clientId: string, userId: string): Promise<boolean> {
  const [clients, staff] = await Promise.all([clientUserIds(clientId), staffUserIds(clientId)]);
  return new Set([...clients, ...staff]).has(userId);
}
