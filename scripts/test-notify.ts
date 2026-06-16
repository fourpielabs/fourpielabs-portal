/**
 * Unit test for the message-notification recipient logic — the single source of
 * truth used by postMessageAction. Run: npx tsx scripts/test-notify.ts
 *
 * Surfaces the two locked tightenings:
 *   #2 internal thread → staff WERE notified AND the client gets ZERO.
 *   #3 the author is NEVER in their own recipient list, in BOTH thread types
 *      (incl. the admin-is-author-and-staff-recipient case).
 */
import { messageRecipientIds } from "../lib/notification-recipients";

const ADMIN = "admin-1", TEAM = "team-1", TEAM2 = "team-2";
const C1 = "client-1", C2 = "client-2";
const staff = [ADMIN, TEAM, TEAM2];
const clients = [C1, C2];

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = "") => {
  console.log(`${cond ? "✓" : "✗"} ${name}${detail ? `  (${detail})` : ""}`);
  cond ? pass++ : fail++;
};

// #2 + #3 — internal, ADMIN author (admin is also a staff recipient)
{
  const r = messageRecipientIds({ threadType: "internal", authorRole: "admin", authorId: ADMIN, clientUserIds: clients, staffUserIds: staff });
  check("internal/admin-author: author (admin) excluded", !r.includes(ADMIN), `recipients=${r.join(",")}`);
  check("internal/admin-author: ZERO client recipients", !r.some((id) => clients.includes(id)), `recipients=${r.join(",")}`);
  check("internal/admin-author: staff WERE notified", r.length > 0 && r.every((id) => staff.includes(id)), `recipients=${r.join(",")}`);
}
// internal, TEAM author
{
  const r = messageRecipientIds({ threadType: "internal", authorRole: "team", authorId: TEAM, clientUserIds: clients, staffUserIds: staff });
  check("internal/team-author: author excluded", !r.includes(TEAM));
  check("internal/team-author: ZERO client recipients", !r.some((id) => clients.includes(id)), `recipients=${r.join(",")}`);
  check("internal/team-author: other staff notified", r.length > 0 && r.includes(ADMIN) && r.includes(TEAM2));
}
// shared, CLIENT author → staff (other side)
{
  const r = messageRecipientIds({ threadType: "client_shared", authorRole: "client", authorId: C1, clientUserIds: clients, staffUserIds: staff });
  check("shared/client-author: recipients = staff", r.length === staff.length && r.every((id) => staff.includes(id)), `recipients=${r.join(",")}`);
  check("shared/client-author: author (client) excluded", !r.includes(C1));
}
// shared, STAFF author → clients (other side)
{
  const r = messageRecipientIds({ threadType: "client_shared", authorRole: "team", authorId: TEAM, clientUserIds: clients, staffUserIds: staff });
  check("shared/staff-author: recipients = clients", r.length === clients.length && r.every((id) => clients.includes(id)), `recipients=${r.join(",")}`);
  check("shared/staff-author: NO staff recipients (author excluded too)", !r.some((id) => staff.includes(id)));
}

console.log(`\n${pass}/${pass + fail} recipient-logic checks passed.`);
if (fail) process.exit(1);
console.log("All recipient-logic checks passed. ✓");
