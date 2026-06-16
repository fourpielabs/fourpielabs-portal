// Pure recipient decision for a NEW MESSAGE — no DB, no server imports, so it is
// unit-testable (scripts/test-notify.ts) AND the single source of truth used by
// postMessageAction. The two boundaries the blueprint requires live HERE:
//   - internal thread → staff ONLY (the client is NEVER a recipient), derived
//     from the REAL thread type (passed straight from the post_message return).
//   - the author is ALWAYS excluded (covers the admin-is-author-and-staff case).

export type ThreadType = "client_shared" | "internal";
export type AuthorRole = "admin" | "team" | "client";

export function messageRecipientIds(input: {
  threadType: ThreadType;
  authorRole: AuthorRole;
  authorId: string;
  clientUserIds: string[];
  staffUserIds: string[];
}): string[] {
  // internal → staff (NEVER the client) · shared → the OTHER side
  const toStaff = input.threadType === "internal" || input.authorRole === "client";
  const base = toStaff ? input.staffUserIds : input.clientUserIds;
  return [...new Set(base)].filter((id) => Boolean(id) && id !== input.authorId);
}
