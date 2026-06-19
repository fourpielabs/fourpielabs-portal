"use client";

import { labelOf, ROLES } from "@/lib/constants";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { StatusPill } from "@/components/redesign/ui";
import { InviteForm } from "./invite-form";
import { UserActiveToggle } from "./user-active-toggle";
import { PendingInviteActions } from "./pending-invite-actions";
import { usePanel, TitledPanel } from "./ui";

export type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  avatar_url: string | null;
  isActive: boolean;
  pending: boolean;
  isSelf: boolean;
  statusValue: "active" | "pending" | "inactive";
  scope: string;
  lastActive: string | null;
};

/** R3 user management body (re-skinned). The guarded actions (toggle/delete with the
 *  self/last-admin server blocks) ride the converted sub-components unchanged. */
export function UsersBody({ users }: { users: UserRow[] }) {
  const { panel, fg1, fg2, fg3, onDark, border } = usePanel();

  const rolePill = (role: string): React.CSSProperties => {
    if (role === "admin") return { background: onDark ? "#f3efe7" : "#1c1917", color: onDark ? "#1c1917" : "#ffffff" };
    if (role === "team") return { background: onDark ? "rgba(255,255,255,0.08)" : "#f1efe8", color: onDark ? "#cdc6ba" : "#57534e" };
    return { background: "transparent", color: fg2, border: `1px solid ${border}` };
  };
  const th: React.CSSProperties = { textAlign: "left", padding: "0.6rem 0.8rem", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: fg3, borderBottom: `1px solid ${border}`, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "0.7rem 0.8rem", fontSize: 13, color: fg1, borderBottom: `1px solid ${border}`, verticalAlign: "middle" };
  const youTag = (
    <span style={{ borderRadius: 999, background: onDark ? "rgba(245,158,11,0.18)" : "#fef3c7", color: onDark ? "#fcd34d" : "#92400e", padding: "1.5px 7px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>You</span>
  );
  const Roles = (r: string) => <span style={{ display: "inline-flex", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600, ...rolePill(r) }}>{labelOf(ROLES, r)}</span>;
  const actions = (u: UserRow) => (u.pending ? <PendingInviteActions userId={u.id} label={u.name ?? u.email ?? "this user"} /> : <UserActiveToggle userId={u.id} isActive={u.isActive} isSelf={u.isSelf} label={u.name ?? u.email ?? "this user"} />);

  return (
    <>
      <TitledPanel title="Invite a staff user" description="Sends a Supabase invitation to an admin or team member. Client portal users are created with their client — see New client. If a send fails you'll see a specific reason (also recorded in the audit log).">
        <InviteForm />
      </TitledPanel>

      {/* desktop table */}
      <div className={panel} style={{ borderRadius: 18, overflow: "hidden", display: "none" }} data-desk>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr><th style={th}>User</th><th style={th}>Role</th><th style={th}>Access</th><th style={th}>Status</th><th style={th}>Last active</th><th style={{ ...th, textAlign: "right" }}>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.6, background: u.pending ? (onDark ? "rgba(245,158,11,0.06)" : "#fffaf0") : undefined }}>
                  <td style={td}>
                    <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <PersonAvatar name={u.name} email={u.email} src={u.avatar_url} size="md" className="shrink-0" />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 500, color: fg1, textDecoration: u.isActive ? "none" : "line-through" }}>{u.name ?? "—"}</span>
                          {u.isSelf && youTag}
                        </span>
                        <span style={{ display: "block", fontSize: 12, color: fg3 }}>{u.email}</span>
                      </span>
                    </span>
                  </td>
                  <td style={td}>{Roles(u.role)}</td>
                  <td style={{ ...td, maxWidth: "16rem", color: fg3, fontSize: 12.5 }}>{u.scope}</td>
                  <td style={td}><StatusPill value={u.statusValue} mode={onDark ? "dark" : "light"} /></td>
                  <td style={{ ...td, color: fg3, fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{u.lastActive ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}><div style={{ display: "inline-flex", justifyContent: "flex-end" }}>{actions(u)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* mobile cards */}
      <div data-mob style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
        {users.map((u) => (
          <div key={u.id} className={panel} style={{ borderRadius: 16, padding: "1rem", opacity: u.isActive ? 1 : 0.6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <PersonAvatar name={u.name} email={u.email} src={u.avatar_url} size="md" className="shrink-0" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 500, color: fg1, textDecoration: u.isActive ? "none" : "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name ?? "—"}</span>
                  {u.isSelf && youTag}
                </div>
                <div style={{ fontSize: 12, color: fg3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }}>
              {Roles(u.role)}
              <StatusPill value={u.statusValue} mode={onDark ? "dark" : "light"} />
              <span style={{ fontSize: 12, color: fg3 }}>{u.scope}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: fg3, fontVariantNumeric: "tabular-nums" }}>Last active {u.lastActive ?? "—"}</div>
            <div style={{ marginTop: 12 }}>{actions(u)}</div>
          </div>
        ))}
      </div>

      <style>{`
        @media(min-width:768px){ [data-desk]{display:block !important;} [data-mob]{display:none !important;} }
      `}</style>
    </>
  );
}
