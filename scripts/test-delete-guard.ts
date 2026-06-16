/**
 * Pure unit test for the user-delete guard (no DB). Run: npx tsx scripts/test-delete-guard.ts
 * The two system-protecting refusals — self-delete and last-active-admin — are the
 * ones that matter most; asserted here deterministically.
 */
import { checkUserDeletable } from "../lib/user-delete-guard";

const results: { ok: boolean }[] = [];
const rec = (n: string, ok: boolean, d = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`);
};
const refused = (r: { ok: boolean }) => r.ok === false;
const allowed = (r: { ok: boolean }) => r.ok === true;

// SELF-DELETE refused (even for a non-admin)
rec(
  "self-delete REFUSED",
  refused(checkUserDeletable({ targetId: "u1", callerId: "u1", targetRole: "team", targetActive: true, activeAdminCount: 3 })),
);

// LAST ACTIVE ADMIN refused
{
  const r = checkUserDeletable({ targetId: "a1", callerId: "a2", targetRole: "admin", targetActive: true, activeAdminCount: 1 });
  rec("last ACTIVE ADMIN delete REFUSED", refused(r), r.ok === false ? r.error : "");
}

// self-check takes precedence even for the last admin
rec(
  "self-delete REFUSED even when target is the last admin",
  refused(checkUserDeletable({ targetId: "a1", callerId: "a1", targetRole: "admin", targetActive: true, activeAdminCount: 1 })),
);

// admin allowed when there's MORE than one active admin
rec(
  "admin delete ALLOWED when 2+ active admins",
  allowed(checkUserDeletable({ targetId: "a1", callerId: "a2", targetRole: "admin", targetActive: true, activeAdminCount: 2 })),
);

// an INACTIVE admin doesn't protect "active admin" availability → allowed
rec(
  "inactive admin delete ALLOWED (doesn't reduce active admins)",
  allowed(checkUserDeletable({ targetId: "a1", callerId: "a2", targetRole: "admin", targetActive: false, activeAdminCount: 1 })),
);

// an ordinary active team/client user → allowed
rec(
  "ordinary user delete ALLOWED",
  allowed(checkUserDeletable({ targetId: "t1", callerId: "a1", targetRole: "team", targetActive: true, activeAdminCount: 1 })),
);

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} delete-guard checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("Delete guard: self-delete and last-active-admin are refused. ✓");
