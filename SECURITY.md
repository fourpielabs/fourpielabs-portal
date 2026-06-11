# Security — 4Pie Labs Client Portal

How the portal protects client data, layer by layer. Safe to share with clients.

## 1. In transit
- **TLS everywhere.** Vercel terminates HTTPS at the edge; the app talks to Supabase
  over HTTPS/WSS. HTTP is upgraded to HTTPS (`upgrade-insecure-requests` in CSP).
- **HSTS:** `Strict-Transport-Security: max-age=63072000; includeSubDomains` (2 years).

## 2. At rest
- **AES-256** encryption of the Postgres database and Storage objects (provided by
  Supabase). Daily backups / PITR available on the paid plan (see LAUNCH.md).

## 3. Access control (the core)
- **Row Level Security on every table**, enforced by Postgres — not just the UI.
  Verified by a repeatable suite: `npm run test:rls` → **97/97** (client cross-client
  reads = 0, all writes denied, RPC gating, team-unassigned + anon fully denied,
  storage signing denied).
- **Three roles** (`admin | team | client`); team is scoped to assigned clients via
  `client_assignments` at both a server guard (`requireClientAccess`) and RLS.
- **One client write path:** clients can only toggle their own onboarding checklist
  items, via the `toggle_checklist_item` SECURITY DEFINER RPC (validates
  ownership/kind/assignee). No other client write exists.
- **Clients never read sensitive columns:** they read narrow, filtered views
  (`client_clients`, `client_partner`) that exclude `internal_notes` and the full
  profiles row.
- **Private Storage bucket** (`client-files`); clients get files only through
  **short-lived signed URLs** minted server-side — no public object access.
- **Privileged operations** (invites, audit writes, user management) run server-side
  with the service-role key; the public/anon API can't reach them.

## 4. Application layer
- **Security headers** (all routes, `next.config.ts`): Content-Security-Policy
  (`default-src 'self'`, Supabase origin in `connect-src`, **no `unsafe-eval`**),
  `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, restrictive `Permissions-Policy`,
  HSTS.
  - *Documented exception:* `script-src`/`style-src` include `'unsafe-inline'` — Next.js
    App Router injects inline bootstrap/RSC scripts (no per-request nonce), and
    Tailwind/Recharts emit inline styles. `'unsafe-eval'` is **not** allowed in production.
- **Authentication:** invite-only (`disable_signup = true`); email + password; minimum
  **12-character** passwords (enforced client + server) with a strength hint; an email
  rate limit (100/hr) and a "your password was changed" notification. The
  **HaveIBeenPwned leaked-password check** is a Supabase Pro feature — enabled at the
  Pro upgrade (LAUNCH.md §2). Email links use
  the **token_hash** flow through a prefetch-safe `/auth/confirm` **interstitial**
  (the one-time token is consumed only on a human button click, not on scanner GETs).
- **Sessions:** `@supabase/ssr` cookies are `HttpOnly`, `Secure` (prod), `SameSite=Lax`;
  refreshed each request in `proxy.ts`. Deactivated users are blocked at the next request.
- **Signed URL TTL:** 60 seconds (files and report PDFs) — well within limits.
- **Secrets:** `SUPABASE_SERVICE_ROLE_KEY` and the Resend SMTP key are server-only and
  appear in **no client bundle** (verified by grepping the deployed build) and were
  **never committed** (verified across full git history). `.env.local` is gitignored.
- **Audit log:** every mutation writes an admin-only `audit_log` row, including
  invite/reset **failures** (`user.invite_failed`, `password_reset.failed`, etc.).

## Supabase security advisors (run regularly)
Command in LAUNCH.md → "Security advisors". Current state after this pass
(`10 → 4` findings):

| Finding | Level | Disposition |
|---|---|---|
| `security_definer_view` — `client_clients`, `client_partner` | ERROR ×2 | **Accepted.** These are the intentional client-safe projections: they deliberately bypass RLS to filter to `my_client_id()` and expose only safe columns (no `internal_notes`, no full profiles row). Granted to `authenticated` only. This is the spec's "client-safe view" pattern. |
| `authenticated_security_definer_function_executable` — `toggle_checklist_item` | WARN | **Accepted.** This is the single client write RPC by design; it validates ownership/kind/assignee internally and only mutates `is_done/done_by/done_at`. |
| `auth_leaked_password_protection` disabled | WARN | **Pending Pro.** HIBP leaked-password protection is a Supabase **Pro** feature (the Management API returns `402` on Free). Min length 12 + client strength hint are already enforced; enable HIBP at the Pro upgrade (LAUNCH.md §2). |
| 6× trigger-function executable (anon/authenticated) | WARN | **Fixed** — `EXECUTE` revoked from API roles on `handle_new_user`, `seed_new_client`, `enforce_profile_self_update` (migration `20260611120000`); triggers still fire. |

## Dependency audit
- `npm audit`: **0 critical, 0 high.** 2 moderate (`postcss` `</style>` XSS) are
  **accepted** — the patched postcss (≥ 8.4.31) is installed (pinned via an
  `overrides` floor), it runs at **build time** on our own trusted CSS (not on
  untrusted runtime input), and npm's only suggested "fix" is an invalid major Next.js
  downgrade.

## Non-goals (v1)
No MFA, no SSO, no field-level encryption beyond at-rest, no WAF beyond Vercel's
defaults. These can be layered on later if a client requires them.
