"use client";

import { type ProgramValues } from "@/lib/schemas";
import { ProgramForm } from "./program-form";
import { MilestonesEditor, type Milestone } from "./milestones-editor";
import { ProgramAssignmentControl, type ProgramAssignment } from "./program-assignment";
import { usePanel } from "./ui";

/**
 * R3 staff Program tab body — two SOLID titled panels (re-skinning the old Card/CardHeader
 * wrappers) holding the program-details form + the milestones editor. Rendered inside the
 * workspace chrome's FluentScope, so it just renders content. All wiring lives in the
 * children (RHF + server actions, verbatim).
 */
export function ProgramBody({
  defaults,
  clientId,
  milestones,
  assignment,
}: {
  defaults: ProgramValues;
  clientId: string;
  milestones: Milestone[];
  assignment: ProgramAssignment;
}) {
  const { panel, fg1, fg3 } = usePanel();

  const title: React.CSSProperties = { margin: 0, fontSize: "1.1rem", fontWeight: 600, color: fg1 };
  const desc: React.CSSProperties = { margin: "0.25rem 0 0", fontSize: "0.9rem", color: fg3 };
  const sectionStyle: React.CSSProperties = { borderRadius: 20, padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section className={panel} style={sectionStyle}>
        <div>
          <h2 className="rd-display" style={title}>Program plan</h2>
          <p style={desc}>The client&rsquo;s program — drives their included services, &ldquo;what&rsquo;s included&rdquo; card, and KPI set. Staff-only.</p>
        </div>
        <ProgramAssignmentControl clientId={clientId} current={assignment} />
      </section>

      <section className={panel} style={sectionStyle}>
        <div>
          <h2 className="rd-display" style={title}>Program overview</h2>
          <p style={desc}>What the client sees on their Program page.</p>
        </div>
        <ProgramForm defaults={defaults} />
      </section>

      <section className={panel} style={sectionStyle}>
        <div>
          <h2 className="rd-display" style={title}>Journey &amp; milestones</h2>
          <p style={desc}>The roadmap shown to the client.</p>
        </div>
        <MilestonesEditor clientId={clientId} milestones={milestones} />
      </section>
    </div>
  );
}
