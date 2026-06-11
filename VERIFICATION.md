# Visual verification script — 4Pie Labs portal (UI reskin)

Click-by-click checks for the keystone designs (K1–K6) and system states, across
**all three roles** on **desktop (1440)** and **phone (390)**. Run after a deploy.

**Demo logins** (password `FourPie!Demo2026`):
- `demo-admin@example.com` — admin
- `demo-team@example.com` — team (assigned to both demo clients)
- `demo-client@example.com` — client (Premier Painting Co.)

**How to test phone:** DevTools → device toolbar → 390px width (iPhone 12-ish), or a real phone.
Prod: `https://fourpielabs-portal.vercel.app`.

---

## 0. Auth shell (K1) — all roles

**Desktop**
1. Open `/login`. ✓ Dark split card: left = form panel (dark, "Sign in to your portal", dark fields, **amber-400** "Forgot password?" link, white-on-**amber-700** "Sign in"); right = brand panel with amber glow, "Client portal" eyebrow, statement, "Live · updated monthly" chip.
2. Click **Sign in** with a wrong password. ✓ Inline red banner "That email and password don't match…", **both** fields outline red.
3. Start typing in either field. ✓ The error clears.
4. Tab through email → password → button. ✓ Each shows the **amber focus ring** (fields: soft halo; button: white-gap + amber ring).
5. Click **Forgot password?** → `/forgot-password`. ✓ Same dark shell; submit an email → "Check your inbox" state. **Back to sign in** returns.
6. Visit `/auth/confirm` with no token. ✓ Single centered dark card: **"Link is invalid or expired"** + Reset password / Back to sign in. *(This is the expired-link page.)*

**Phone (390)**
7. `/login` ✓ Brand panel collapses to a **compact glowing header** above the form; "Sign in" is full-width; targets ≥44px.

---

## 1. Client experience — sign in as `demo-client`

### K2 Dashboard (`/dashboard`)
**Desktop**
1. ✓ Greeting reads **"Morning/Afternoon/Evening, Premier — here's {Month} at a glance"** (time-of-day from your clock; the month word is bold). Partner card top-right.
2. ✓ KPI cards: Bricolage tabular numerals, **▲/▼ delta pill** (green up / **red down — down-deltas are not hidden**), "vs N last month", and a small **amber sparkline** under each.
3. **Start here** card: click an open checklist circle. ✓ It fills **amber-600 with a spring "pop"**, the row text strikes through, the progress bar animates. Team rows show a dashed icon + *"We'll take care of this."*; link rows show an **Open** pill.
4. Tick every remaining client item. ✓ When all are done the card **collapses to the green line "Onboarding complete — you're all set."** with a **Review** link; click Review to re-expand. *(Toggle one back off to reset for re-demo.)*
5. ✓ Roadmap: milestone cards with status-colored top borders, a **"Day N of 90"** amber chip, progress bar. ✓ The **dark report card** (amber glow) is the only dark card on the page.

**Phone (390)**
6. ✓ Floating white **bottom tab bar**: Home · Program · Content · Numbers · More, active slot = 48px charcoal circle.
7. Tap **More**. ✓ A bottom sheet opens with Deliverables · Calls & Notes · Documents. Tap one → navigates and the sheet closes.

### K3 Performance (`/performance`)
8. ✓ "Your numbers, live". Chart card: **amber line, 2.5px, white-fill dots**, hairline horizontal grid, dark tooltip with amber value. Change the metric selector → series + axis re-scale; **only months with data** show (no empty leading months).
9. ✓ Competitor cards are **schema-only**: name/niche + **priority chip**, follower/avg-views rows **hide when null**, "What's working" / "The gap", and **"Our play" in an amber-50 block**.
10. ✓ Reports: selecting a report tints its row amber-50 + amber left-border; the viewer shows branded markdown + Download PDF. **No draft reports are visible.**

### Other client tabs
11. **Program** ✓ Details, journey milestones with **milestone status chips**, What's included/not (markdown), Working-together. Title in the display font.
12. **Content** ✓ List + Month toggle (segmented), **content status chips**; on phone the month view stays legible.
13. **Deliverables** ✓ Status-key row of **deliverable chips** + per-item chips; signed-URL downloads.
14. **Calls & Notes** / **Documents** ✓ Cards + chips, friendly empty states, display-font titles.

---

## 2. Staff workspace — sign in as `demo-team`

### Shell
1. **Desktop** ✓ 264px sidebar: logo, **client switcher** (dropdown → jumps to a client), nav with **charcoal active pill**, user row + Sign out. No bottom tab bar.
2. **Phone** ✓ Top bar with hamburger → **drawer** with the same sidebar; client switcher inside.

### K4 Client overview (`/clients/{id}`)
3. ✓ Header: **initials tile** (amber), client name, **status chip**, program · **Day N of 90**.
4. ✓ If any deliverable is in *Needs review*, an amber **"Waiting on client"** banner appears with an **Open deliverable** button (navigates to the Deliverables tab — not an email).
5. ✓ **Checklist ring** (% in the center) + per-phase counts; **latest-metrics 2×2** with "Entered {Month} **by {user}**" + an **Enter month** button; activity feed.
6. ✓ Tab bar is **underline style**; click **More** → overflow menu (Notes · Reports · Updates · Files · Settings).

### K5 Metrics (`/clients/{id}/metrics`)
7. **Monthly entry** tab ✓ One input per row, right-aligned tabular numerals.
8. Click the first value, then press **Tab** repeatedly. ✓ Focus moves **straight down the value column**.
9. Change two values; type a non-number in one. ✓ Those rows tint **amber (#FFFBEB)** with an amber-400 border + "· unsaved"; the bad one turns **red** with an inline **"Enter a number."**; the **sticky save bar reads "2 unsaved · 1 error"** and **Save is disabled**.
10. Fix the bad value → bar reads "2 unsaved"; **Save {Month}** enables; click it → toast "Saved…", rows clear. **Discard** reverts unsaved edits.
11. **CSV import** tab ✓ Paste/upload a CSV with one bad row → preview shows green **OK** chips and a **red error chip + tinted row**; button reads "Commit N valid rows" (commits clean rows only).
12. **Definitions** tab ✓ Add/Edit; **↑/↓ buttons reorder** a definition (saves immediately).
13. **Charts** tab ✓ Same chart component the client sees (client preview).

### Other staff tabs
14. Checklist editor, Program/milestones, Content calendar, Competitors (**priority chips**), Deliverables, Calls, Notes, Reports (**draft/published chips**), Updates, Files ✓ all render with the finalized **Table / Dialog / Select / Textarea / DropdownMenu / Avatar / prose** styling.

### Access guard (team)
15. As `demo-team`, all client tabs work for assigned clients. *(Cross-client/unassigned access is denied at RLS — covered by `npm run test:rls`, 97/97.)*

---

## 3. Admin — sign in as `demo-admin`

### K6 Users (`/admin/users`)
1. ✓ **Invite a user** card: email + role; the **client select appears only when role = Client** (and is required).
2. ✓ Table shows the **Active / Pending invite / Inactive trio** as user chips: Pending rows have a **warm tint + dashed clock chip**; Inactive rows are **0.6 opacity with a struck-through name** (never red).
3. ✓ Your own row shows a **"You"** marker and **no Deactivate control** (self-lockout).
4. On a **Pending** row: **Resend** works; **Revoke** opens a confirm dialog naming the person ("{name} hasn't accepted yet…") with a **red Revoke** action.
5. On an **Active** non-self row: **Deactivate** opens a confirm dialog "Deactivate {name}? They'll be signed out and blocked at the login gate on their next request. You can reactivate anytime." with a **red Deactivate** action. Inactive rows show **Reactivate**.
6. ✓ Error toasts name the cause; rate-limit copy is generic ("try again in a few minutes").

### Audit + settings
7. **Audit log** (`/admin/audit`) ✓ Read-only table of mutations with the finalized table styling.
8. **Settings** (`/settings`) ✓ Profile form; saves via its server action.

---

## 4. System states & accessibility (any role)
1. Visit a bad URL (e.g. `/clients/does-not-exist`). ✓ Branded **404** "Page not found" + Back to dashboard.
2. ✓ Navigating between heavy pages briefly shows the **loading skeleton**.
3. Empty states (a client with no content/deliverables/reports). ✓ Friendly dashed empty cards, not blank.
4. **Keyboard:** Tab through any page — **every** interactive element shows the amber focus ring; dialogs and menus are keyboard-operable (Esc closes).
5. **Reduced motion:** OS "reduce motion" on → the checklist pop and transitions are disabled.
6. **Contrast/colour:** statuses/deltas always pair colour with a **glyph/dot/dashed border** (never colour alone).

---

## Notes / known items
- **Lighthouse (mobile, /login):** performance 55 · **accessibility 100** · best-practices 96 · SEO 91 (was perf ~28 / a11y 96 pre-reskin).
- **Login stays client-side** (`signInWithPassword`) — the LAUNCH.md "login server-action" perf idea is **deferred**: converting it touches the frozen auth flow. The remaining perf gap on `/login` is client-JS from the browser Supabase client.
- Editable **staff** status (deliverable/content/milestone) uses **Selects**, not display chips — by design (interactive).
