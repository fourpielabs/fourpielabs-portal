import DOMPurify from "isomorphic-dompurify";

// Allow only the tags/attrs our TipTap schema produces. DOMPurify strips scripts,
// event handlers, javascript: URIs, etc. by default — this is the render-side XSS guard
// for stored rich HTML (defense in depth on top of the structured TipTap output).
// Single source of truth: imported by both the renderer (rich-message.tsx) and the
// round-trip/XSS test (scripts/test-content-format.ts).
export const RICH_SANITIZE = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "code", "pre", "blockquote", "ul", "ol", "li", "h3", "span", "a"],
  // data-href/role/tabindex carry the S5 #-link chip (a span the client turns into a deep-link on
  // click; the href is set ONLY by the server resolver from an internal route, never author input).
  ALLOWED_ATTR: ["class", "href", "target", "rel", "data-id", "data-label", "data-type", "data-href", "role", "tabindex"],
};

export function sanitizeRich(html: string): string {
  return DOMPurify.sanitize(html, RICH_SANITIZE);
}

// The content-format discriminator: a message with non-empty rich HTML renders as rich
// (sanitized); otherwise its legacy markdown body renders via <Markdown>. Pure, so the
// coexistence rule is testable without a DOM.
export function rendersAsRich(bodyRich?: string | null): boolean {
  return !!bodyRich && bodyRich.trim().length > 0;
}
