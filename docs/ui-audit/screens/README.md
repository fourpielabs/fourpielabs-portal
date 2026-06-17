# Screenshots — index & reachability notes

**102 PNGs** = 51 routes × 2 viewports, captured with
[../tools/audit-screens.mjs](../tools/audit-screens.mjs) against a local production server
(`npm run start`, `:3000`).

- **Viewports:** desktop **1440×900** and mobile **390×844**, `fullPage: true`.
- **Naming:** `{role}__{route}__{vp}.png`, where `{route}` slugifies `/` → `_`.
  - `role` ∈ `public · admin · team · client-program · client-project`
  - In per-client routes, **`P` = the program client** (Premier Painting Co.,
    `fb11ee5e-…`) and **`J` = the project client** (Demo Project Co., `53865671-…`).
    e.g. `admin__clients_P_metrics__1440.png`, `admin__clients_J_projects__1440.png`.
- Run metadata (redirects + console errors) is in [./_run-log.md](./_run-log.md).

## Coverage matrix

| Role | What's captured |
|---|---|
| **public** | `/login`, `/forgot-password`, `/accept-invite` (unauthenticated) |
| **admin** | `/dashboard`, `/settings`, `/clients`, `/clients/new`, `/admin/users`, `/admin/audit`; the **full program-client workspace** (Overview, Messages, Checklist, Program, Content, Metrics, Competitors, Deliverables, Tasks, Calls, Notes, Reports, Updates, Files, **Settings**); the **project-client workspace** (Overview, Projects, Deliverables, Tasks, Calls) |
| **team** | role-distinct surfaces: `/dashboard`, `/settings`, `/clients` (assignment-scoped), + program & project client Overview |
| **client-program** | `/dashboard`, `/settings`, `/messages`, `/program`, `/content`, `/performance`, `/deliverables`, `/tasks`, `/calls-notes`, `/documents` |
| **client-project** | `/dashboard`, `/settings`, `/messages`, `/deliverables`, `/tasks`, `/calls-notes`, `/documents` |

## Reachability notes (what we could / couldn't reach, and why)

- **0 unexpected redirects** — every targeted route resolved (including all client-type-gated
  pages, since we used the correct role/type for each). Confirmed in `_run-log.md`.
- **Team per-client workspace tabs are intentionally not re-shot.** They render the **same
  components** as the admin per-client tabs (minus the admin-only **Settings** tab), so the
  canonical capture is under `admin__clients_P_*` / `admin__clients_J_*`. Team coverage is its
  role-distinct surfaces (scoped Dashboard/Clients + assigned-client Overview). This avoids ~30
  byte-identical duplicate images.
- **Console error on every authenticated page:** `net::ERR_SSL_PROTOCOL_ERROR` (one per
  role/viewport). A single failed resource request — see finding **C3** in
  [../findings.md](../findings.md).
- **The real project-client account was _not_ used.** The only pre-existing project client,
  "FourPie Labs" (`fourpie-labs`), has a real login (`fourpielabs@gmail.com`) whose password we
  won't reset. Instead we provisioned an **isolated demo project client** (below) so the
  project-client-side UI could be captured without touching real data.

## Demo project client provisioning (how the project-client shots were produced)

To capture the project-client experience, [../tools/provision-demo-project.mjs](../tools/provision-demo-project.mjs)
created **isolated, non-destructive demo data** via the service role:

- Client **"Demo Project Co."** (`slug: demo-project`, `client_type: project`, `status: active`).
- Login **`demo-project@example.com` / `FourPie!Demo2026`** (role `client`).
- 3 projects (active / proposed / complete) + 2 deliverables so the board isn't empty.
- The demo team member is assigned so staff routes reach it too.

This is the **only** non-doc change this audit made. To remove it later:

```sql
delete from clients where slug = 'demo-project';   -- cascades child rows (projects, deliverables, threads)
-- then delete the auth user demo-project@example.com (Supabase dashboard → Auth, or admin API)
```
