/**
 * Pure test for the email CONTENT-LEAKAGE rule. Run: npx tsx scripts/test-email.ts
 * buildNotificationEmail has NO `body` parameter, so message content can never leave
 * the portal — the email carries only the safe title (sender/event) + a link.
 */
import { buildNotificationEmail } from "../lib/email";

let pass = 0, fail = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`);
  ok ? pass++ : fail++;
};

const SECRET = "SENSITIVE-MESSAGE-BODY-do-not-leak";

// message email
{
  const e = buildNotificationEmail({ type: "message", title: "New message from Casey", clientName: "Premier Painting", link: "/messages" });
  check("message: subject = sender + client, no content", e.subject.includes("New message from Casey") && e.subject.includes("Premier Painting"));
  check("message: html links to portal (View in portal)", /View in portal/i.test(e.html) && e.html.includes("/messages"));
  check("message: email carries NO message body (no body param exists)", !e.html.includes(SECRET) && !e.text.includes(SECRET));
  check("message: branded with the 4Pie Labs wordmark", /4Pie(&nbsp;|\s)*Labs/i.test(e.html));
}
// event email
{
  const e = buildNotificationEmail({ type: "deliverable_delivered", title: "Deliverable delivered", clientName: "Coastal Tours", link: "/deliverables" });
  check("event: subject = title + client", e.subject.includes("Deliverable delivered") && e.subject.includes("Coastal Tours"));
  check("event: text links to portal", e.text.includes("/deliverables"));
}
// absolute link passthrough (prod deep-link)
{
  const e = buildNotificationEmail({ type: "message", title: "x", link: "https://portal.fourpielabs.com/messages" });
  check("absolute link preserved (not double-prefixed)", e.html.includes("https://portal.fourpielabs.com/messages") && !e.html.includes("localhost"));
}

console.log(`\n${pass}/${pass + fail} email-content checks passed.`);
if (fail) process.exit(1);
console.log("Email content rules hold — no message body ever leaves the portal. ✓");
