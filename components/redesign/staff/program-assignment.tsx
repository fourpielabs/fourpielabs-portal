"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Segmented, EmberButton, tokens } from "@/components/redesign/ui";
import { Switch } from "@/components/ui/switch";
import { setClientProgramsAction, type CoreTier } from "@/lib/actions/program";

export type ProgramAssignment = { coreTier: CoreTier; pulse: boolean };

const CORE_OPTIONS = [
  { value: "foundation", label: "Core" },
  { value: "pipeline", label: "Pipeline" },
  { value: "operating_system", label: "Operating System" },
  { value: "none", label: "None" },
] as const;

const PROGRAM_NAME: Record<string, string> = {
  foundation: "Core",
  pipeline: "Pipeline",
  operating_system: "Operating System",
};

export function ProgramAssignmentControl({
  clientId,
  current,
}: {
  clientId: string;
  current: ProgramAssignment;
}) {
  const router = useRouter();
  const fg1 = tokens.colorNeutralForeground1, fg2 = tokens.colorNeutralForeground2, fg3 = tokens.colorNeutralForeground3;
  const [core, setCore] = React.useState<string>(current.coreTier ?? "none");
  const [pulse, setPulse] = React.useState<boolean>(current.pulse);
  const [saving, setSaving] = React.useState(false);

  const coreTier: CoreTier = core === "none" ? null : (core as CoreTier);
  const dirty = (current.coreTier ?? "none") !== core || current.pulse !== pulse;
  const invalid = !coreTier && !pulse;

  const summary = coreTier
    ? `${PROGRAM_NAME[coreTier]}${pulse ? " + Pulse" : ""}`
    : pulse
      ? "Pulse only"
      : "No program — pick a core tier or Pulse";

  async function save() {
    if (invalid || !dirty) return;
    setSaving(true);
    const res = await setClientProgramsAction(clientId, coreTier, pulse);
    setSaving(false);
    if (res.ok) {
      toast.success("Program updated", { description: `Now: ${summary}. Services + KPIs re-resolved.` });
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const fieldLabel: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 600, color: fg2, marginBottom: 6 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <div style={fieldLabel}>Core tier <span style={{ fontWeight: 400, color: fg3 }}>· stacks (each includes the previous)</span></div>
        <Segmented options={CORE_OPTIONS as unknown as { value: string; label: string }[]} value={core} onChange={setCore} ariaLabel="Core program tier" />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, maxWidth: 460 }}>
        <div>
          <div style={fieldLabel}>Pulse <span style={{ fontWeight: 400, color: fg3 }}>· parallel social add-on</span></div>
          <p style={{ margin: 0, fontSize: "0.82rem", color: fg3 }}>Runs alongside any core tier, or on its own.</p>
        </div>
        <Switch checked={pulse} onCheckedChange={setPulse} aria-label="Pulse add-on" />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ fontSize: "0.85rem", color: invalid ? "#b45309" : fg1 }}>
          <span style={{ color: fg3 }}>Assignment: </span>
          <span style={{ fontWeight: 600 }}>{summary}</span>
        </div>
        <EmberButton onClick={save} disabled={saving || invalid || !dirty}>
          {saving ? "Saving…" : "Save program"}
        </EmberButton>
      </div>
    </div>
  );
}
