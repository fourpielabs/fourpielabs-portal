// Pure guard for hard-deleting a user — no DB, no server imports, so it's
// unit-testable (scripts/test-delete-guard.ts) AND the single source of truth
// the deleteUserAction enforces. The two refusals that protect the system live
// HERE: you can't delete yourself, and you can't remove the LAST ACTIVE ADMIN
// (which would lock everyone out of admin).

export type DeleteGuardInput = {
  targetId: string;
  callerId: string;
  targetRole: "admin" | "team" | "client";
  targetActive: boolean;
  activeAdminCount: number; // count of currently-active admins (includes the target if they're one)
};

export function checkUserDeletable(
  input: DeleteGuardInput,
): { ok: true } | { ok: false; error: string } {
  if (input.targetId === input.callerId) {
    return { ok: false, error: "You can't delete your own account." };
  }
  if (input.targetRole === "admin" && input.targetActive && input.activeAdminCount <= 1) {
    return { ok: false, error: "You can't delete the last active admin." };
  }
  return { ok: true };
}
