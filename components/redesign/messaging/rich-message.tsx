"use client";

import * as React from "react";
import { Markdown } from "@/components/markdown";
import { sanitizeRich, rendersAsRich } from "@/lib/messaging/sanitize";

/**
 * Renders a message's content. NEW messages carry rich HTML in `bodyRich` (TipTap) →
 * sanitized + rendered. OLD messages have bodyRich = null → the legacy markdown `body`
 * renders via <Markdown> exactly as before. The two coexist with no history re-encoding.
 * The sanitize allow-list + discriminator live in lib/messaging/sanitize (single source
 * of truth shared with the round-trip/XSS test).
 */
export function RichMessage({ body, bodyRich, fg1 }: { body: string; bodyRich?: string | null; fg1: string }) {
  if (rendersAsRich(bodyRich)) {
    const clean = sanitizeRich(bodyRich as string);
    return <div className="rd-msg" style={{ fontSize: 14, color: fg1 }} dangerouslySetInnerHTML={{ __html: clean }} />;
  }
  return body ? <div className="rd-msg" style={{ fontSize: 14, color: fg1 }}><Markdown>{body}</Markdown></div> : null;
}
