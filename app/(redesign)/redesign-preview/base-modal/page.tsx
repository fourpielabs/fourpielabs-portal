"use client";

import * as React from "react";
import { BaseModal, Button, EmberButton, Input, Textarea, Select, Field, Eyebrow, tokens } from "@/components/redesign/ui";

/**
 * Dev-only isolation harness for BaseModal (Track 1, step 1). One default-open modal
 * exercises everything: a title, a pinned footer, form controls (incl. a Select to
 * review dropdown chrome), and long scrolling content — to verify sizing, the single
 * scroll region, no horizontal overflow, and a11y in light / dark / 390w. Not shipped.
 */
export default function BaseModalHarness() {
  // open AFTER mount — real modals open on interaction; SSR-opening a Fluent Dialog
  // (a portal) causes a hydration mismatch. This keeps the harness client-only.
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setOpen(true), []);
  const fg1 = tokens.colorNeutralForeground1, fg2 = tokens.colorNeutralForeground2;

  return (
    <div style={{ minHeight: "100dvh", padding: "2rem", display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 className="rd-display" style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600, color: fg1 }}>BaseModal — isolation harness</h1>
      <p style={{ margin: 0, color: fg2 }}>Use the floating Dark/Light pill to check both themes. Resize to 390w for mobile.</p>
      <EmberButton onClick={() => setOpen(true)}>Open modal</EmberButton>

      <BaseModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Edit deliverable"
        size="md"
        footer={<>
          <Button appearance="subtle" onClick={() => setOpen(false)}>Cancel</Button>
          <EmberButton onClick={() => setOpen(false)}>Save changes</EmberButton>
        </>}
      >
        <Field label="Title"><Input defaultValue="Homepage redesign — v2" /></Field>
        <Field label="Status">
          <Select defaultValue="in_progress">
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </Select>
        </Field>
        <Field label="Priority">
          <Select defaultValue="high">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </Field>
        <Field label="Notes"><Textarea defaultValue="A couple of lines of context so the body has some height." resize="vertical" /></Field>
        <div>
          <Eyebrow tone="muted">Wide content check</Eyebrow>
          <p style={{ margin: "4px 0 0", color: fg2, fontSize: 14 }}>ThisIsAVeryLongUnbrokenTokenToConfirmTheBodyWrapsAndNeverCausesHorizontalScroll_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA</p>
        </div>
        {/* long content → the body (and ONLY the body) scrolls; header + footer stay pinned */}
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} style={{ padding: "0.6rem 0.8rem", borderRadius: 10, border: `1px solid ${tokens.colorNeutralStroke2}` }}>
            <div style={{ fontWeight: 600, color: fg1, fontSize: 14 }}>Scrolling row {i + 1}</div>
            <div style={{ color: fg2, fontSize: 13 }}>One scroll region — no double scrollbars; the footer below stays put.</div>
          </div>
        ))}
      </BaseModal>
    </div>
  );
}
