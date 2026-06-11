# 4Pie Labs Client Portal — Design Brief (for the Claude Design session)

> You are designing the UI for an existing, fully working client portal.
> Three reference images accompany this brief (ref-1, ref-2, ref-3).
> Your job: produce a design system + high-fidelity HTML mockups per §12.
> HARD RULE: design ONLY the screens and features in this brief. Do not
> invent features (the references contain chat widgets and meeting
> schedulers — this product has neither). The feature inventory is closed.

---

## 1. The product & who judges it

A client portal for 4Pie Labs (fourpielabs.com), an AI-first marketing
agency for local service businesses. Three audiences:

- **Clients** (business owners, often on phones): see KPIs, a 90-day
  roadmap, deliverables, reports, content calendar, competitor tracker,
  call booking, meeting notes, documents — and tick an onboarding
  checklist. This surface is a **retention tool**: every month the client
  logs in and decides the agency is worth the retainer. It must feel like
  proof of momentum — premium, calm, confident.
- **Team** (agency staff): manage all of the above per client. They enter
  monthly metrics for many clients — density and speed matter.
- **Admins**: everything + user management, invites, audit log.

Stack reality (your output must be implementable in it): Next.js +
Tailwind CSS v4 + shadcn/ui (Radix), Lucide icons, Recharts. Mockups must
be self-contained HTML/CSS that maps cleanly onto that stack.

## 2. Reference synthesis — take this, not that

**ref-1 (dark split login):** TAKE the split-screen auth layout — form
panel left, brand panel right with logo + statement + subtle glow.
ADAPT: charcoal `#101012`-ish base with a soft amber radial glow instead
of monochrome. IGNORE the email-code tabs (we are password + reset only).

**ref-2 (soft dashboard):** TAKE the layout intelligence — left sidebar,
card grid, the onboarding checklist pattern with a dark pill for the
active step, the soft rounded card language, the files panel style.
ADAPT: replace pink/lavender gradients with barely-there warm neutrals
(amber-tinted, very low saturation), used ONLY on hero/welcome surfaces.
IGNORE: the chat widget (feature doesn't exist), the search-everything
bar (not in v1).

**ref-3 (mobile):** TAKE the entire mobile language — large mixed-weight
greeting ("Here's your **work** plan"), pill buttons (solid charcoal +
outline pair), dark time/status pills, avatar-rich cards, generous
radii, and the **bottom tab bar with circular active state** for the
client mobile experience. IGNORE Google Meet/Zoom branding.

Synthesis in one line: **light, warm, spacious app · charcoal as the
structural dark (pills, hero cards, primary buttons) · amber as the one
accent · dark split-screen auth.**

## 3. Brand foundation (from fourpielabs.com — match it)

- Accent: **amber `#d97706`** (their confirmed brand accent).
- Voice: confident, direct, zero fluff ("No pitch deck", "Leave with a
  plan"). Microcopy should sound like that — "Your numbers, live", not
  "Welcome to your analytics experience".
- Signature patterns to echo: their **stat/proof bar** (→ our KPI
  cards), the **week-by-week 90-day timeline** (→ our roadmap), the
  "Live · +18 citations this week" ticker feel (→ how fresh metrics are
  framed), program cards (→ client cards on staff side).
- Logo: wordmark "4Pie Labs" with an amber dot (assume text logo; leave
  a slot for the real asset).

## 4. Design tokens (deliver as CSS custom properties)

Define and use a complete token sheet. Required structure:

**Neutrals (warm-tinted, not blue-gray):** `--bg` near-white warm
(#FAFAF8-ish), `--surface` white, `--surface-2` warm gray-50,
`--border`, `--ink` charcoal #18181B-ish, `--ink-2` secondary text,
`--ink-3` muted. Dark set for auth + hero cards: `--dark-bg` #101012-ish,
`--dark-surface`, `--dark-border`, light ink equivalents.

**Amber ramp:** 50→900 around #d97706. Accessibility rules baked in:
amber text on light backgrounds uses 700/800 (AA); white text sits only
on amber-700+ or use dark ink on amber-500/600 fills; amber-600 reserved
for fills, progress, active states, focus rings.

**Semantic status colors** (see §7), success/warning/danger/info ramps.

**Type:** Display = Bricolage Grotesque (Google Fonts) for greetings,
page titles, big KPI numerals (or propose ONE alternative with
rationale); UI/body = Inter, tabular-nums for all metric numerals. Scale:
display-xl/lg, h1–h4, body, body-sm, caption, overline (letterspaced
uppercase like the agency site's eyebrows).

**Shape & depth:** radii sm 8 / md 12 / lg 16 / xl 24 / pill 999. Shadows:
3 elevations, soft and warm, no harsh drops. Spacing: 4px base scale;
client surfaces use a spacious rhythm, staff surfaces a compact rhythm
(same tokens, tighter steps).

**Motion:** 150–200ms ease-out for hovers/menus, 250–300ms for
sheets/dialogs, checklist tick gets a small satisfying spring; honor
prefers-reduced-motion.

## 5. Layout architecture (three shells)

**Auth shell** — dark split-screen (ref-1). Mobile: brand panel collapses
to a compact header above the form.

**Client shell** — Desktop/tablet: clean top nav (logo left; Dashboard ·
Program · Content · Performance · Deliverables · Calls & Notes ·
Documents; avatar menu right). Mobile: **bottom tab bar** (ref-3) with 5
slots: Home, Program, Content, Performance, More (sheet with the rest) —
plus compact top header with greeting/avatar. Spacious density.

**Staff shell (team + admin)** — Desktop: **left sidebar** (ref-2):
logo, client switcher/search, nav (Dashboard, Clients; admin also Users,
Audit), collapsed-to-icon-rail option; content area with a per-client
horizontal tab bar (Overview · Checklist · Program · Content · Metrics ·
Competitors · Deliverables · Calls · Notes · Reports · Updates · Files ·
Settings — overflow into a "More" dropdown beyond ~8). Tablet: sidebar
collapses to icon rail. Mobile: sidebar becomes a drawer; tabs scroll
horizontally. Compact density.

Breakpoints: 360 (min), 768, 1024, 1440. Everything must be designed
for all three device classes; mockups are required at desktop 1440 and
mobile 390 (tablet may be described, not mocked).

## 6. Component inventory (design every one, with states)

Buttons (primary charcoal pill, accent amber, secondary outline, ghost,
destructive, icon-button; hover/active/disabled/loading) · Inputs (text,
textarea, select/dropdown, combobox, date picker, month picker, file
dropzone w/ progress; default/focus/error/disabled + helper & error
text) · Checkbox/radio/switch · The **checklist row** (client-tickable
circle → amber tick animation, team rows show "We'll take care of this",
link rows get a pill button) · Badges & status chips (§7) · Tabs
(underline for page tabs, pill segmented control for view switches like
List/Month) · Cards (KPI card w/ delta arrow, deliverable card, report
card, competitor card, file row, update/feed card, booking card) ·
Tables (staff data tables: sticky header, row hover, inline status
dropdown, row actions menu; mobile card-collapse pattern) · The
**monthly metrics entry grid** (label + unit + input per row, tab-flow,
single sticky Save bar) · CSV import flow (dropzone → preview table with
per-row OK/error states → commit bar) · Modals & confirm dialogs ·
Dropdown/context menus · Toasts (success/error/info, with the specific-
error pattern e.g. "SMTP authentication failed") · Progress (bar +
ring) · Avatars & avatar groups · Empty states (illustrated-lite: icon +
headline + one-liner + optional CTA; warm, branded copy) · Loading
skeletons (cards, table rows, chart) · Pagination/load-more · Markdown
prose style (for updates, notes, report summaries) · Month-calendar grid
(content calendar: items as compact chips by status; mobile = agenda
list) · Chart frame (§9) · Sidebar/nav items (default/active/hover) ·
User menu · Alert banners (e.g. "invite pending", "report is a draft —
hidden from client").

Icons: Lucide only, 1.5px stroke weight, consistent sizing (16/20/24).

## 7. Semantic status system (one global language)

Design chips/badges once, apply everywhere. Required mappings:
- Deliverables: Pending (neutral) · In Progress (amber) · Needs Review
  (violet or blue — distinct from amber) · Delivered (green).
- Content workflow: Idea (neutral) · Drafting (amber-soft) · In Review
  (blue) · Approved (teal) · Scheduled (indigo) · Published (green).
- Milestones: Upcoming (neutral outline) · In Progress (amber) · Done
  (solid amber or green — pick one and justify; agency timeline uses
  amber for "now").
- Clients: Onboarding (amber) · Active (green) · Paused (neutral) ·
  Churned (red-muted).
- Users: Active (green) · Pending invite (amber outline, distinct) ·
  Inactive (neutral strikethrough-feel).
- Competitor priority: High (amber/red) · Medium · Low.
- Reports: Draft — hidden from client (neutral + eye-off icon) ·
  Published (green).
All chip text humanized ("In progress", never `in_progress`).

## 8. Screen specs

**Keystones — full mockups required (desktop 1440 + mobile 390):**

K1 **Login** — ref-1 treatment. Left: logo, "Sign in to your portal",
email + password, amber primary button, "Forgot password?" link. Right
(desktop): dark brand panel, amber-glow gradient, statement like "Every
number, deliverable, and win — in one place." Include error state.

K2 **Client Dashboard** — mobile-first thinking. Greeting block
(display type, ref-3 style: "Morning, Pat — here's **March** at a
glance"), KPI cards w/ month label + delta ("This month · March 2026",
"▲ 20 vs last month"), Start Here checklist card (progress bar, phases,
tickable rows; collapsed single-line variant when complete), roadmap
progress card, latest deliverables, latest report, updates feed,
"Your Partner" card (avatar, name, contact channel). Mobile: bottom tab
bar visible.

K3 **Client Performance** — chart card (windowed to months with data),
metric selector, text-metrics monthly table (newest first), competitor
cards, reports list + one shown as the report-viewer state (markdown
summary + PDF button).

K4 **Staff Client Overview** — sidebar shell + client header (logo
initials, name, program/status chips, partner) + tab bar + overview
cards (checklist progress, latest metrics, recent activity).

K5 **Staff Metrics tab** — the three-part surface: definitions manager
list, the monthly entry grid (the speed-matters surface — show the
sticky save bar), and a chart preview. Include the CSV import preview
state (mix of OK and error rows).

K6 **Admin Users** — invite form, users table with the full status
trio (Active / Pending invite w/ Resend+Revoke actions / Inactive),
role chips, confirm-dialog state for Revoke.

**All other screens — covered by the system, one-line directions:**
Forgot password & Accept-invite (auth shell, single card, password
strength hint) · Confirm interstitial ("You're almost there" + Continue
button, branded, also its expired-link error variant) · Client Program
(details grid, journey timeline echoing the agency 90-day section,
included/not-included two-up, working-together card) · Client Content
(list + month chip-calendar; mobile agenda) · Client Deliverables
(status-keyed cards) · Calls & Notes (booking cards w/ amber Book
button, recordings list, notes feed) · Documents (category-grouped file
rows) · Staff dashboard (client grid w/ status + quick stats) ·
Checklist editor · Program editor · Content calendar manage (table +
month + item form) · Competitors manage · Calls manage · Notes ·
Reports manage (draft/published states) · Updates composer · Files
manager · Client settings (incl. team assignment) · Audit viewer
(filter bar + event table) · Profile settings · 404/error page (branded,
useful).

## 9. Data-viz theme

Recharts-compatible: single-series line/area in amber-600 with soft
amber gradient fill fading to transparent; grid lines hairline warm
gray; axis labels Inter caption; tooltip = dark charcoal card, white
text, amber value; delta arrows green-up/red-down (colorblind-safe:
pair with ▲▼ glyphs). Numerals tabular. Empty chart state designed.

## 10. Microcopy voice

Short, warm, confident. Examples to use verbatim in mockups: "Your
first report lands after month 1." · "Onboarding complete — you're all
set." · "We'll take care of this." · "Draft — hidden from client." Use
the real demo content for realism: Premier Painting Co. (Pipeline),
Coastal Tours Co. (Pulse), Riley Partner, metrics like Leads 140 ▲20.
NO lorem ipsum anywhere.

## 11. Quality bar

WCAG AA contrast throughout (mind amber-on-light rules in §4) · visible
amber focus rings on every interactive element · 44px minimum tap
targets on mobile · keyboard-reachable menus/dialogs · honors
prefers-reduced-motion · looks intentional at 360px wide.

## 12. What you must deliver, in order (gates between each)

1. **Style tile** — one HTML artifact: tokens in action (palette, type
   scale, buttons, inputs, chips, one KPI card, one checklist row, light
   + dark surfaces). STOP for approval.
2. **Component sheet** — one HTML artifact: every §6 component in every
   state, organized by section, on the real tokens. STOP for approval.
3. **Keystone mockups K1–K6** — one self-contained HTML artifact each,
   desktop 1440 layout with a mobile 390 variant section in the same
   artifact. Real content per §10. Deliver one at a time.
4. **Handoff sheet** — final HTML/markdown artifact: the complete CSS
   variable token sheet, font imports, spacing/radius/shadow values,
   status-color map, and notes per keystone for the implementing
   engineer (this goes straight to Claude Code).

Constraints: self-contained HTML/CSS (system + Google Fonts only),
Lucide-style inline SVG icons fine, no external images (use gradients/
initials/avatars as colored circles), no JS needed beyond trivial state
demos. Stay implementable in Tailwind v4 + shadcn/ui — no exotic CSS
that won't translate.
