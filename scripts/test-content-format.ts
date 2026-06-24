/**
 * Track 5 S1 — content-format round-trip + XSS unit test.
 *
 * The migration introduces `messages.body_rich` (TipTap HTML) alongside the legacy
 * markdown `body`. The two MUST coexist with NO history re-encoding:
 *  - OLD messages (body_rich = null) render their markdown `body` unchanged.
 *  - NEW messages render `body_rich`, sanitized through a strict allow-list.
 * This asserts: the discriminator, formatting preservation (round-trip), the @mention
 * span survival, and that XSS payloads are stripped (idempotently).
 *
 * Uses the SAME sanitize module the renderer uses (lib/messaging/sanitize) — single
 * source of truth, so a drift in the allow-list breaks this test.
 */
import { sanitizeRich, rendersAsRich, RICH_SANITIZE } from "../lib/messaging/sanitize";

let pass = 0, fail = 0;
const ok = (n: string, cond: boolean, d = "") => { (cond ? pass++ : fail++); console.log(`${cond ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

// 1) discriminator — null / empty → legacy markdown path; non-empty → rich path
ok("discriminator: body_rich=null → legacy markdown", rendersAsRich(null) === false);
ok("discriminator: body_rich='' → legacy markdown", rendersAsRich("") === false);
ok("discriminator: body_rich='   ' (blank) → legacy markdown", rendersAsRich("   ") === false);
ok("discriminator: body_rich='<p>hi</p>' → rich", rendersAsRich("<p>hi</p>") === true);

// 2) round-trip: TipTap formatting survives the sanitizer unchanged
const rich = '<p>Hello <strong>bold</strong> and <em>italic</em> and <s>strike</s></p><ul><li>one</li><li>two</li></ul><blockquote><p>quote</p></blockquote><p><code>code()</code></p><h3>Heading</h3>';
const cleaned = sanitizeRich(rich);
ok("round-trip: <strong> preserved", cleaned.includes("<strong>bold</strong>"));
ok("round-trip: <em> preserved", cleaned.includes("<em>italic</em>"));
ok("round-trip: <s> strike preserved", cleaned.includes("<s>strike</s>"));
ok("round-trip: bullet list preserved", cleaned.includes("<ul>") && cleaned.includes("<li>one</li>"));
ok("round-trip: blockquote preserved", cleaned.includes("<blockquote>"));
ok("round-trip: inline code preserved", cleaned.includes("<code>code()</code>"));
ok("round-trip: h3 preserved", cleaned.includes("<h3>Heading</h3>"));

// 3) @mention span (TipTap Mention) survives with its data-* + class
const mention = '<p>cc <span class="rd-mention" data-type="mention" data-id="u-123" data-label="Alex">@Alex</span> please</p>';
const mClean = sanitizeRich(mention);
ok("mention: span class survives", mClean.includes('class="rd-mention"'));
ok("mention: data-id survives (the validated id)", mClean.includes('data-id="u-123"'));
ok("mention: visible @label survives", mClean.includes("@Alex"));

// 4) safe links survive; javascript: URI is stripped
const link = '<p><a href="https://example.com" target="_blank" rel="noopener">site</a></p>';
ok("link: safe https href + rel survive", sanitizeRich(link).includes('href="https://example.com"'));
const jsLink = '<p><a href="javascript:alert(1)">x</a></p>';
ok("xss: javascript: URI stripped from href", !sanitizeRich(jsLink).toLowerCase().includes("javascript:"));

// 4b) S5 # deep-link entity chips: the server resolver outputs a span with data-href (accessible)
// or an "unavailable" span; both survive the client sanitize. The title is set via textContent
// server-side (auto-escaped), so a malicious title renders inert.
const entOk = '<p>see <span class="rd-entity" data-href="/clients/abc/tasks?task=123" role="link" tabindex="0">#Ship the homepage</span></p>';
const entClean = sanitizeRich(entOk);
ok("entity chip: resolved span (data-href) survives", entClean.includes('class="rd-entity"') && entClean.includes('data-href="/clients/abc/tasks?task=123"') && entClean.includes("#Ship the homepage"));
const entGone = '<p>see <span class="rd-entity rd-entity--gone">#unavailable</span></p>';
ok("entity chip: 'unavailable' span survives (no leak)", sanitizeRich(entGone).includes("rd-entity--gone") && sanitizeRich(entGone).includes("#unavailable"));
const entTitleXss = '<span class="rd-entity" data-href="/tasks?task=1">#&lt;img src=x onerror=alert(1)&gt;</span>';
ok("entity chip: a server-escaped malicious title stays inert (no <img>)", !sanitizeRich(entTitleXss).toLowerCase().includes("<img"));
// a raw <a href="javascript:"> (not produced by us) is still stripped by the sanitizer
const entJs = '<p><a class="rd-entity" href="javascript:alert(1)">#x</a></p>';
ok("entity chip: javascript: href stripped by sanitizer", !sanitizeRich(entJs).toLowerCase().includes("javascript:"));

// 5) XSS payloads stripped
const xss ='<p>hi</p><script>alert(1)</script><img src=x onerror="alert(2)"><iframe src="https://evil"></iframe><p onclick="steal()">click</p>';
const xClean = sanitizeRich(xss).toLowerCase();
ok("xss: <script> stripped", !xClean.includes("<script") && !xClean.includes("alert(1)"));
ok("xss: <img onerror> stripped", !xClean.includes("<img") && !xClean.includes("onerror"));
ok("xss: <iframe> stripped", !xClean.includes("<iframe"));
ok("xss: onclick handler stripped", !xClean.includes("onclick"));
ok("xss: benign <p>hi</p> kept", xClean.includes("<p>hi</p>"));

// 6) sanitize is idempotent (sanitizing twice == once — safe to re-render)
ok("idempotent: sanitize(sanitize(x)) === sanitize(x)", sanitizeRich(xClean) === xClean || sanitizeRich(sanitizeRich(xss)) === sanitizeRich(xss));

// 7) allow-list shape sanity (catches accidental widening)
ok("allow-list: no event-handler attrs allowed", !RICH_SANITIZE.ALLOWED_ATTR.some((a) => a.toLowerCase().startsWith("on")));
ok("allow-list: no <script>/<img>/<iframe> tags allowed", !["script", "img", "iframe"].some((t) => RICH_SANITIZE.ALLOWED_TAGS.includes(t)));

console.log(`\n${pass}/${pass + fail} passed.`);
process.exit(fail ? 1 : 0);
