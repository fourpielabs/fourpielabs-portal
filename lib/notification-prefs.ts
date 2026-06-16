// Per-user EMAIL notification preference types — the single source of truth for the
// type↔column map, human labels, and which ROLES can receive each type. Pure (no
// server imports) so it's shared by notify() (send-logic gate), the settings UI, and
// the tsx tests. Columns map 1:1 to notification_preferences (4e migration).

export type EmailPrefRole = "client" | "team" | "admin";

export const EMAIL_PREF_TYPES: {
  type: string;
  column: string;
  label: string;
  description: string;
  roles: EmailPrefRole[];
}[] = [
  { type: "message", column: "email_message", label: "New messages", description: "When someone messages you on a thread.", roles: ["client", "team", "admin"] },
  { type: "deliverable_delivered", column: "email_deliverable_delivered", label: "Deliverable ready", description: "When a new deliverable is delivered to you.", roles: ["client"] },
  { type: "deliverable_approved", column: "email_deliverable_approved", label: "Deliverable approved", description: "When a client approves a deliverable.", roles: ["team", "admin"] },
  { type: "report_published", column: "email_report_published", label: "New report published", description: "When a report is published for you.", roles: ["client"] },
  { type: "project_status", column: "email_project_status", label: "Project status updates", description: "When a project's status changes.", roles: ["client", "team", "admin"] },
];

export const emailPrefColumn = (type: string): string | undefined =>
  EMAIL_PREF_TYPES.find((t) => t.type === type)?.column;

export const emailPrefTypesForRole = (role: string) =>
  EMAIL_PREF_TYPES.filter((t) => t.roles.includes(role as EmailPrefRole));
