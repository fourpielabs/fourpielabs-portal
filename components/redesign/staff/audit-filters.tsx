"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmberButton, Select } from "@/components/redesign/ui";
import { usePanel } from "./ui";

/**
 * R3 read-only audit filters (re-skin of components/admin/audit-filters.tsx) — Fluent
 * Select client/action filters on a SOLID panel; pushes ?client=&action= to the URL (no
 * mutation, no server-action/RHF). Mode-aware throughout; glass forbidden on this surface.
 * Same props + URL behavior as the original.
 */
export function AuditFilters({
  clients,
  actions,
  current,
}: {
  clients: { id: string; name: string }[];
  actions: string[];
  current: { client?: string; action?: string };
}) {
  const router = useRouter();
  const { panel, fg3 } = usePanel();
  const [client, setClient] = useState(current.client ?? "all");
  const [action, setAction] = useState(current.action ?? "all");
  const filtered = Boolean(current.client || current.action);

  function apply() {
    const params = new URLSearchParams();
    if (client !== "all") params.set("client", client);
    if (action !== "all") params.set("action", action);
    const qs = params.toString();
    router.push(`/admin/audit${qs ? `?${qs}` : ""}`);
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "0.62rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: fg3,
  };

  return (
    <section
      className={panel}
      style={{
        borderRadius: 18,
        padding: "1rem 1.1rem",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: "0.85rem",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={labelStyle}>Client</label>
        <div style={{ minWidth: 220 }}>
          <Select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={labelStyle}>Action</label>
        <div style={{ minWidth: 240 }}>
          <Select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="all">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <EmberButton size="small" onClick={apply}>
        Filter
      </EmberButton>
      {filtered && (
        <Button
          appearance="subtle"
          size="small"
          onClick={() => {
            setClient("all");
            setAction("all");
            router.push("/admin/audit");
          }}
        >
          Clear
        </Button>
      )}
    </section>
  );
}
