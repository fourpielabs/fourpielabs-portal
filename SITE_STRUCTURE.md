# 4Pie Labs Portal — Site Structure & Target State (UI-5 contract)

> The definitive map of every route: its purpose, sections top-to-bottom,
> components, mobile behavior, and design source. This is the grading
> rubric for the fidelity audit and the acceptance contract for
> remediation. Design sources: K1–K6 mockups, D2 component sheet, D4
> handoff sheet (all in design/). Where no keystone exists, the screen is
> DERIVED: assembled strictly from D2 components on the correct shell —
> derived never means transitional. Frozen-logic guardrail applies
> throughout: structure and presentation only.

Legend: [K#]=keystone source · [D]=derived from system · 🖥=desktop · 📱=mobile 390

---

## SHELLS

**AUTH SHELL** — dark split-screen: left form panel (dark surface, light
text, amber-400 links, white-on-amber-700 CTA), right brand panel (dark,
amber radial glow, statement + live-citations chip). 📱 brand panel
collapses to compact glowing header above the form. Single-card variant
(brand=false) for confirm/expired.

**CLIENT SHELL** — 🖥 floating top-nav pill bar: logo left; Dashboard ·
Program · Content · Performance · Deliverables · Calls & Notes ·
Documents; avatar right. Spacious density. 📱 compact top header
(greeting context + avatar) + floating bottom tab bar: Home, Program,
Content, Performance, More (sheet: Deliverables, Calls & Notes,
Documents, Sign out). No bells, no search.

**STAFF SHELL** — 🖥 264px sidebar: logo, "Jump to client" switcher
(RLS-scoped), nav (Dashboard, Clients; admin: + Users, Audit with ADMIN
badges), identity card bottom (avatar, name, role, Sign out). Per-client
pages add a horizontal underline tab bar with "More" overflow. Compact
density. 📱 sidebar becomes drawer (hamburger); tabs scroll horizontally.

---

## AUTH ROUTES

**/login [K1]** — split shell. Form: "Sign in to your portal" display
title, email + password (dark inputs, 44px), amber-700 CTA "Sign in",
forgot-password link (amber-400). Error state: banner "That email and
password don't match. Try again, or reset your password." + both fields
flagged, clears on typing. Brand panel: "Every number, deliverable, and
win — in one place." + Live chip. Help line — team@fourpielabs.com.

**/forgot-password [K1-derived]** — same split shell. One email field,
amber CTA, success state ("Check your inbox — link expires in 1 hour"
style copy), back-to-login link.

**/accept-invite [K1-derived]** — split shell. Set-password form: 12-char
minimum + strength hint, confirm field, amber CTA "Set my password".
Serves invite AND recovery flows.

**/auth/confirm [D]** — single centered dark card (brand=false):
"You're almost there" + amber Continue button (the prefetch-safe
interstitial). Error variant: "This link is invalid or expired" +
guidance to request a fresh one. Both branded, never raw errors.

---

## CLIENT ROUTES (role=client; spacious; mobile-first; zero edit
affordances beyond the checklist toggle)

**/dashboard [K2]** top-to-bottom:
1. Greeting: time-of-day + PERSON first name — "Morning, Pat — here's
   **June 2026** at a glance" (month bold, display font); subline:
   program chip + Day N of 90.
2. Partner card: avatar, "Your Partner", name, contact channel.
3. KPI row (4): overline label, display tabular number, ▲▼ delta pill,
   "vs N last month", amber mini-sparkline. 📱 2×2 grid.
4. Two-column: LEFT Start Here checklist — "N of 15 done" + progress
   bar, phase overlines, tickable rows (amber tick-pop, strikethrough),
   team rows "We'll take care of this.", link rows get pill buttons;
   complete state collapses to one-line "Onboarding complete — you're
   all set." + Review. RIGHT: dark Latest-report card (glow, title,
   View report amber CTA) — height capped to content / filled with
   summary excerpt, NEVER a stretched black void; below it Updates
   (pinned first).
5. Roadmap card: progress bar + 5 phase chips w/ StatusChip.
6. Latest deliverables (status-chipped rows).
📱 bottom tab bar present; checklist tap targets ≥44px.

**/program [K2-system]** — "Your program" header; Details two-column
grid (Program, Service type, Investment, Started, Ends—"Ongoing");
Your journey — 5 milestone cards w/ phase labels + StatusChip; What's
included / not included two-up cards (markdown bullets); Working
together card (reach, response time, scheduling [hide if unset],
revisions).

**/content [D]** — "Content calendar / What we're planning and
publishing."; charcoal SEGMENTED control List|Month (D2 — not a blob);
List: title, platform · type · humanized date, StatusChip per content
workflow colors, View link on published. Month: chip-per-item calendar
grid. 📱 month becomes agenda list.

**/performance [K3]** — chart card: metric selector (Select), amber
line/area windowed to months WITH data, dark tooltip; Month-by-month
table newest-first w/ ▲▼ on every cell; text-metrics rows; Competitor
landscape: schema-only cards (priority chip, niche, What's working /
The gap / Our play amber block; nullable stats hidden); Reports: list +
viewer (markdown prose + Download PDF). 📱 per-month metric cards
replace the wide table.

**/deliverables [D]** — status key legend; deliverable cards: title,
type, humanized dates, StatusChip, Preview link / Download (signed URL).

**/calls-notes [D]** — Book a call: card per call_type (name, duration ·
frequency, amber Book button → booking_url); Recordings list (date,
type, topic, link); Meeting notes feed (date, title, markdown body).

**/documents [D]** — files grouped by category overlines (Agreement,
Onboarding form, Welcome doc, Invoices & payments, Other); file rows:
icon, name, size, Download via signed URL.

---

## STAFF ROUTES (role=team/admin; compact density)

**/dashboard (staff home) [D — currently the worst offender]** — NOT a
link card. Target:
1. "Welcome, {first name}" display header + subline.
2. CLIENT GRID: card per (assigned) client — initials tile, name, slug,
   program chip + StatusChip, quick stats line (checklist N/15 ·
   latest-month leads or top metric · last activity relative time),
   whole card clickable → overview. Empty state if team has none.
3. Admin variant adds a row of entry cards ON-SYSTEM: Users (count +
   pending invites count, Manage button), Audit (last event time, View
   button) — real Buttons, not underlined text links.

**/clients [D]** — designed data table (D2 table spec: overline headers,
hairline dividers, hover): initials tile + name + slug, program chip,
StatusChip, quick stat, actions as Button components (Open, Settings
[admin]). Admin: "New client" charcoal button. 📱 rows collapse to cards.

**/clients/[id] — workspace shell [K4]** — client header: initials tile,
name, program + StatusChip, "Partner: {name} · client since {Month
Year} · Day N of 90"; underline tab bar: Overview · Checklist · Program
· Content · Metrics · Competitors · Deliverables · Calls + More (Notes,
Reports, Updates, Files, Settings[admin]).

Tabs:
- **Overview [K4]**: Waiting-on-client amber banner (needs_review →
  "Open deliverable" action) when applicable; checklist progress ring +
  per-phase counts; latest-metrics 2×2 + "Entered {Month} by {user}" +
  Enter-month CTA; derived activity feed.
- **Checklist [D]**: Onboarding|Off-boarding segmented; rows with tick,
  assignee, link, visibility eye, ↑/↓, edit/delete; Add item form.
- **Program [D]**: program-overview form fields (staff-editable) +
  milestones editor (add/edit/status Select/↑↓/delete).
- **Content [D]**: segmented Table|Month; filterable table (platform,
  status), inline status Select, row actions; item form in Dialog/sheet;
  New content button.
- **Metrics [K5]**: segmented Definitions | Monthly entry | CSV | Charts.
  Definitions: list w/ unit, active toggle, ↑↓ (moveMetricDefinition),
  add/edit. Entry grid: month picker, one input per row (tab-down),
  dirty tint + "· unsaved", inline validation, sticky bar "[n] unsaved ·
  [n] error" + Discard + Save {Month} (disabled while errors). CSV:
  dropzone, template link, preview w/ per-row OK/error chips + tint,
  "Commit N valid rows". Charts: the client-preview chart.
- **Competitors [D]**: cards matching K3's schema-only pattern + edit/
  delete + visibility; priority chip; Add form.
- **Deliverables [D]**: table/cards w/ StatusChip, due dates, visibility
  eye, file upload, edit Dialog, delete confirm.
- **Calls [D]**: call-types manager (name/duration/frequency/URL/sort) +
  recordings log (date/type/URL/topic/visibility).
- **Notes [D]**: meeting-notes list + markdown editor form, visibility.
- **Reports [D]**: list w/ Draft("hidden from client" + eye-off)/
  Published chips; create/edit (period, markdown summary, PDF upload);
  Publish/Unpublish with confirm.
- **Updates [D]**: composer (markdown, pin, visibility) + feed w/ edit/
  delete own.
- **Files [D]**: upload w/ category Select + visibility; category-
  grouped rows; signed-URL download; delete confirm.
- **Settings [D, admin]**: client fields form; status Select; team
  assignment (assign/unassign w/ confirm); program-overview fields.

**/admin/users [K6]** — invite card (email, name, role Select; client
Select appears only for role=Client; charcoal Send invitation; specific
error toasts); users table: avatar tile, name + email (plain text),
role chip, access list, StatusChip trio (Active / Pending invite dashed
/ Inactive struck + 0.6 opacity), actions: Resend+Revoke (pending),
Deactivate (active), Reactivate (inactive), "You" self-row w/ no
deactivate; named confirm dialogs w/ red destructive actions.

**/admin/audit [D]** — filter bar (Client + Action Selects, Filter
button), table: when (humanized), actor, action code chip, client,
details (truncated JSON, expandable). Latest 200 note.

**/settings [D]** — own profile: avatar, full name, email (read-only),
password change link/flow. On-system form components.

---

## SYSTEM

**404 / error boundary [D]** — branded: display headline ("This page
doesn't exist" / "Something went wrong"), one-liner, charcoal button
home. Dark-card treatment acceptable.
**Loading** — skeletons per D2 (cards, table rows, chart), never blank
white or spinners-only.
**Empty states** — every list: dashed frame, icon, warm one-liner per
brief voice, optional CTA.

---

## ACCEPTANCE

Every route grades A or B (B gaps enumerated and accepted explicitly).
No underlined-text-links-as-buttons, no default-styled tables, no raw
enum strings, no ISO dates client-facing, no component not traceable to
D2, no button without a real server action. Build green · test:rls
97/97 · Vercel green · desktop 1440 + mobile 390 verified per route.
