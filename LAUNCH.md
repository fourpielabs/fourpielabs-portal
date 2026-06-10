# LAUNCH.md — 4Pie Labs Client Portal go-live runbook

Every step here is a **human dashboard task** (Vercel / Supabase / DNS). Do them
**in order**. Claude does not perform these — several touch billing, DNS, secrets,
or are intentionally manual (the destructive-remote rule + demo-account teardown).

> Production domain: **`portal.fourpielabs.com`** · Supabase project ref:
> **`frmukrgjkhlpxplhzeqj`** (Tokyo) · GitHub: `fourpielabs/fourpielabs-portal`
> (auto-deploys `main` to Vercel).

---

## 0. Pre-flight (already true)
- `main` is green on Vercel; all migrations applied; `npm run test:rls` passes 97/97.
- Vercel project has the 4 env vars set (from earlier). You'll **update one** in step 7.

---

## 1. Vercel Hobby → Pro
Hobby is not for production client traffic (no SLA, function limits, no team).
1. Vercel → the `fourpielabs` team/project → **Settings → Billing** → **Upgrade to Pro**.
2. Confirm the `fourpielabs-portal` project is under the Pro team (not a personal Hobby scope).

## 2. Supabase paid plan (REQUIRED)
**The free tier auto-pauses a project after ~7 days of inactivity — unacceptable for
a client portal** (clients would hit a dead site). Move to at least **Pro**.
1. Supabase → project `frmukrgjkhlpxplhzeqj` → **Settings → Billing** → subscribe to **Pro**.
2. Confirm **"Pause after inactivity" is gone** (Pro projects don't auto-pause).
3. (Recommended) enable **Point-in-Time Recovery** / daily backups.

## 3. Custom SMTP via Resend (so invites/recovery emails actually deliver)
Supabase's built-in mailer is rate-limited (~2–4/hr) and only reliably mails project
members — useless for inviting real clients.
1. **Resend** → add & **verify the sending domain** (e.g. `fourpielabs.com` or
   `mail.fourpielabs.com`): add the DKIM/SPF/Return-Path DNS records Resend shows.
2. Create a Resend **API key**.
3. Supabase → **Authentication → Emails → SMTP Settings** → enable custom SMTP:
   - Host `smtp.resend.com` · Port `465` (SSL) or `587` (TLS)
   - Username `resend` · Password = the Resend API key
   - Sender email `noreply@fourpielabs.com` (or your verified address) · Sender name `4Pie Labs`
4. Raise the **rate limits** (Auth → Rate Limits) now that real SMTP is in place.
5. **Test:** from the live app as admin, invite yourself at a real address → confirm
   delivery + that the link works (after step 4 below).

## 4. Auth URL configuration + email templates  (Supabase → Authentication)
### 4a. URL configuration (Authentication → URL Configuration)
- **Site URL:** `https://portal.fourpielabs.com`
- **Redirect URLs (allow-list)** — add all of:
  - `https://portal.fourpielabs.com/**`
  - `http://localhost:3000/**`  (local dev)
- Keep **email signups disabled** (Authentication → Providers → Email: "Enable signups" OFF — invite-only; already disabled in `supabase/config.toml` for local).

### 4b. Email templates (Authentication → Emails → Templates)
The app verifies links at **`/auth/confirm`** via `token_hash` (see `app/auth/confirm/route.ts`).
Point each template at it. Use these (branded amber, plain + on-brand copy):

**Invite user** — subject `You're invited to your 4Pie Labs portal`:
```html
<h2>Welcome to 4Pie Labs 👋</h2>
<p>Your client portal is ready. Click below to set your password and jump in.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/accept-invite"
     style="background:#d97706;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">
    Set up my portal
  </a>
</p>
<p style="color:#666;font-size:12px">If you didn't expect this, you can ignore this email.</p>
```

**Reset password** — subject `Reset your 4Pie Labs password`:
```html
<h2>Reset your password</h2>
<p>Click below to choose a new password for your 4Pie Labs portal.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/accept-invite"
     style="background:#d97706;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">
    Choose a new password
  </a>
</p>
<p style="color:#666;font-size:12px">Didn't request this? You can safely ignore it.</p>
```

**Confirm signup / Change email** (signups are disabled, but if Supabase still uses the
Confirm template for email changes, point it the same way):
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`

> `/auth/confirm` handles `type` = `invite | recovery | email` and redirects to `next`.
> `/accept-invite` is the "set your password" screen used for both invite and recovery.

## 5. Custom domain on Vercel + DNS
1. Vercel → project → **Settings → Domains** → add `portal.fourpielabs.com`.
2. Vercel shows the target. Add this **DNS record at the `fourpielabs.com` DNS host**:
   - **CNAME** · name `portal` · value **`cname.vercel-dns.com`** (use the exact target
     Vercel displays). TTL default/auto.
   - (If the DNS provider won't CNAME a subdomain, use the **A record** Vercel offers
     instead, e.g. `76.76.21.21` — always use the value Vercel shows, not a guess.)
3. Wait for Vercel to show **"Valid Configuration"** + issue the SSL cert.

## 6. (covered above — DNS is part of step 5)

## 7. Switch the app's site URL env to production
1. Vercel → project → **Settings → Environment Variables** → set **Production**:
   - `NEXT_PUBLIC_SITE_URL = https://portal.fourpielabs.com`
   - (verify the other three are present: `NEXT_PUBLIC_SUPABASE_URL`,
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — server-only).
2. **Redeploy** (Deployments → ⋯ → Redeploy) so the new env takes effect.
   (`NEXT_PUBLIC_SITE_URL` is what the invite/recovery `redirectTo` uses.)

## 8. Rotate the database password + clean up local secret
You shared the DB password into the local User-scope env for migrations/seeding.
Rotate it now and remove the local copy.
1. Supabase → **Settings → Database → Reset database password** → set a new one (save it
   in your password manager, not in the repo).
2. On your machine, **remove the User-scope secret** so it no longer lingers:
   ```powershell
   [Environment]::SetEnvironmentVariable('SUPABASE_DB_PASSWORD', $null, 'User')
   ```
   (Keep `SUPABASE_ACCESS_TOKEN` only if you still run the CLI locally; otherwise remove it too.)
3. Future migrations: `supabase db push` will prompt for the new password (or set it for
   that shell only).

> ⚠️ Per the standing rule, no destructive remote DB command runs without your explicit
> approval. A password reset is your action in the dashboard.

## 9. LAST — deactivate the demo accounts (you, via the UI, after final verification)
Do this **only after** the final production verification in the next section passes.
1. Sign in to `https://portal.fourpielabs.com` as `demo-admin@example.com`.
2. **Admin → Users** → Deactivate: `demo-admin@example.com`, `demo-team@example.com`,
   `demo-client@example.com`. (Deactivate the **admin last**, or use a second real admin.)
   - Better: first **invite your real admin account**, sign in as it, then deactivate all
     three demo accounts so you never lock yourself out.
3. Optionally set the two demo clients (Premier Painting Co., Coastal Tours Co.) to
   **Churned**, or leave them as visible sample data — your call.

> The demo accounts are deactivated by **you via the UI** — never by a script.

---

## Performance note (from P6 Lighthouse, mobile)
- Login page: **Accessibility 96 · Best-practices 100 · SEO 91 · Performance ~28 (mobile, lab)**.
- Mobile performance is dominated by client JS (the Supabase auth client bundled into the
  login form + framework hydration). Real-world warm loads are better than the throttled lab number.
- **Optional optimization** (deferred to avoid destabilizing the verified auth flow):
  move `/login` sign-in to a **server action** so `@supabase/supabase-js` isn't in the
  login first-load bundle. Re-Lighthouse after.
- **To Lighthouse the auth-gated pages** (dashboard, performance, team client-overview):
  sign in in Chrome, open **DevTools → Lighthouse**, run against the loaded page (uses your
  session cookies). Targets: a11y ≥ 95, best-practices ≥ 95, performance ≥ 50 (mobile).
