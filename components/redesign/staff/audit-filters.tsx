"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button, EmberButton, Select } from "@/components/redesign/ui";
import { DateField } from "@/components/redesign/ui/date-field";
import { exportAuditCsvAction } from "@/lib/actions/audit";
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
  current: { client?: string; action?: string; from?: string; to?: string };
}) {
  const router = useRouter();
  const { panel, fg3 } = usePanel();
  const [client, setClient] = useState(current.client ?? "all");
  const [action, setAction] = useState(current.action ?? "all");
  const [from, setFrom] = useState(current.from ?? "");
  const [to, setTo] = useState(current.to ?? "");
  const [exporting, setExporting] = useState(false);
  const filtered = Boolean(current.client || current.action || current.from || current.to);

  function apply() {
    const params = new URLSearchParams();
    if (client !== "all") params.set("client", client);
    if (action !== "all") params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    router.push(`/admin/audit${qs ? `?${qs}` : ""}`);
  }

  // Export the CURRENTLY-APPLIED filter set (from the URL) — staff/admin-only; the action
  // re-checks requireRole(["admin"]) server-side, so this control is a convenience only.
  async function exportCsv() {
    setExporting(true);
    const res = await exportAuditCsvAction({ client: current.client, action: current.action, from: current.from, to: current.to });
    setExporting(false);
    if (!res.ok) return toast.error("Export failed", { description: res.error });
    const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = res.filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${res.count} row${res.count === 1 ? "" : "s"}.`);
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

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={labelStyle}>From</label>
        <div style={{ minWidth: 150 }}>
          <DateField value={from} onChange={setFrom} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={labelStyle}>To</label>
        <div style={{ minWidth: 150 }}>
          <DateField value={to} onChange={setTo} />
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
            setFrom("");
            setTo("");
            router.push("/admin/audit");
          }}
        >
          Clear
        </Button>
      )}
      <Button appearance="outline" size="small" icon={<Download size={15} />} loading={exporting} onClick={exportCsv} style={{ marginLeft: "auto" }}>
        Export CSV
      </Button>
    </section>
  );
}
