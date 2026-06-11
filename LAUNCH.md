# LAUNCH.md — 4Pie Labs Client Portal go-live runbook

Every step here is a **human dashboard task** (Vercel / Supabase / DNS). Do them
**in order**. Claude does not perform these — several touch billing, DNS, secrets,
or are intentionally manual (the destructive-remote rule + demo-account teardown).

> **Launch target: the Vercel production URL** → **`https://fourpielabs-portal.vercel.app`**
> The custom domain **`portal.fourpielabs.com`** is a **later cutover** — see the
> final section.
> Supabase project ref: **`frmukrgjkhlpxplhzeqj`** (Tokyo) · GitHub:
> `fourpielabs/fourpielabs-portal` (auto-deploys `main` to Vercel).

---

## 0. Pre-flight (already true)
- `main` is green on Vercel; all migrations applied; `npm run test:rls` passes 97/97.
- Vercel project already has 3 of the 4 env vars; **`NEXT_PUBLIC_SITE_URL` is not set** —
  you set it in step 5.

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
4. **Enable leaked-password protection (HIBP)** — Pro-only, currently blocked on Free
   (`402`). Once on Pro, run:
   ```bash
   curl -s -X PATCH -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
     -H "Content-Type: application/json" -d '{"password_hibp_enabled":true}' \
     "https://api.supabase.com/v1/projects/frmukrgjkhlpxplhzeqj/config/auth"
   ```
   Then re-run the advisors command — `auth_leaked_password_protection` should clear,
   leaving only the 3 accepted findings (2 client-safe definer views + the
   `toggle_checklist_item` client RPC).

## 3. Custom SMTP via Resend (so invites/recovery emails actually deliver)
Supabase's built-in mailer is rate-limited (~2–4/hr) and only reliably mails project
members — useless for inviting real clients.
1. **Resend** → add & **verify the sending domain `mail.fourpielabs.com`**: add the
   DKIM/SPF/Return-Path DNS records Resend shows on `mail.fourpielabs.com`.
2. Create a Resend **API key**.
3. Supabase → **Authentication → Emails → SMTP Settings** → enable custom SMTP:
   - Host `smtp.resend.com` · Port `465` (SSL) or `587` (TLS)
   - Username `resend` · Password = the Resend API key
   - **Sender email `noreply@mail.fourpielabs.com` · Sender name `4Pie Labs`**
     (identity: `4Pie Labs <noreply@mail.fourpielabs.com>`)
4. Raise the **rate limits** (Auth → Rate Limits) now that real SMTP is in place.
5. **Test:** after step 4 below, invite yourself at a real address from the live app and
   confirm delivery + that the link works.

## 4. Auth URL configuration + email templates  (Supabase → Authentication)
### 4a. URL configuration (Authentication → URL Configuration)
- **Site URL:** `https://fourpielabs-portal.vercel.app`
- **Redirect URLs (allow-list)** — add all of:
  - `https://fourpielabs-portal.vercel.app/**`
  - `http://localhost:3000/**`  (local dev)
- Keep **email signups disabled** (Authentication → Providers → Email: "Enable signups" OFF —
  invite-only; already disabled in `supabase/config.toml` for local).

### 4b. Email templates (Authentication → Emails → Templates)
The app verifies links at **`/auth/confirm`** via `token_hash` (see `app/auth/confirm/route.ts`).
The templates use `{{ .SiteURL }}`, so they automatically follow whatever **Site URL** is set
in 4a (today the Vercel URL; later the custom domain — no template edits needed at cutover).
Paste each block into its matching template slot (branded amber):

**Slot: "Invite user"** — subject `You're invited to your 4Pie Labs portal`:
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

**Slot: "Reset password"** — subject `Reset your 4Pie Labs password`:
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

**Slot: "Confirm signup"** (signups are disabled; Supabase also uses this slot for
email-change confirmations — point it the same way):
```html
<h2>Confirm your email</h2>
<p>Confirm this email address for your 4Pie Labs portal.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard"
     style="background:#d97706;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">
    Confirm email
  </a>
</p>
<p style="color:#666;font-size:12px">If this wasn't you, you can ignore this email.</p>
```

> `/auth/confirm` handles `type` = `invite | recovery | email` and redirects to `next`.
> `/accept-invite` is the "set your password" screen used for both invite and recovery.

## 5. Set the app's site-URL env to the Vercel URL
1. Vercel → project → **Settings → Environment Variables** → **Production**:
   - **`NEXT_PUBLIC_SITE_URL = https://fourpielabs-portal.vercel.app`** (currently unset)
   - verify the other three exist: `NEXT_PUBLIC_SUPABASE_URL`,
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only).
2. **Redeploy** (Deployments → ⋯ → Redeploy) so the new env is baked in.
   (`NEXT_PUBLIC_SITE_URL` is what the invite/recovery `redirectTo` uses.)

## 6. Rotate the database password + clean up local secret
You shared the DB password into the local User-scope env for migrations/seeding.
Rotate it now and remove the local copy.
1. Supabase → **Settings → Database → Reset database password** → set a new one (store it in
   a password manager, not the repo).
2. On your machine, **remove the User-scope secret**:
   ```powershell
   [Environment]::SetEnvironmentVariable('SUPABASE_DB_PASSWORD', $null, 'User')
   ```
   (Keep `SUPABASE_ACCESS_TOKEN` only if you still run the CLI locally; otherwise remove it too.)
3. Future migrations: `supabase db push` will prompt for the new password.

> ⚠️ Per the standing rule, no destructive remote DB command runs without your explicit
> approval. A password reset is your action in the dashboard.

## 7. Final production verification (on the Vercel URL)
Run the verification pass (login per role, one negative test each, real invite end-to-end)
against **`https://fourpielabs-portal.vercel.app`**. Only after it passes, do step 8.

## 8. LAST — deactivate the demo accounts (you, via the UI)
1. **Invite your real admin account first**, sign in as it (so you don't lock yourself out).
2. Sign in to `https://fourpielabs-portal.vercel.app` → **Admin → Users** → Deactivate
   `demo-admin@example.com`, `demo-team@example.com`, `demo-client@example.com`.
3. Optionally set the two demo clients to **Churned**, or keep them as sample data.

> Demo accounts are deactivated by **you via the UI** — never by a script.

---

## LATER — custom domain cutover to `portal.fourpielabs.com`
Do this whenever you're ready to move off the Vercel URL. Mini-checklist:

1. **Add the domain on Vercel** → project → **Settings → Domains** → add
   `portal.fourpielabs.com`. Vercel shows the DNS target.
2. **DNS** at the `fourpielabs.com` host:
   - **CNAME** · name `portal` · value **`cname.vercel-dns.com`** (use the exact target
     Vercel displays). If the provider can't CNAME a subdomain, use the **A record** Vercel
     offers instead. Wait for Vercel **"Valid Configuration"** + SSL issued.
3. **Supabase → Authentication → URL Configuration:**
   - **Site URL →** `https://portal.fourpielabs.com`
   - **Redirect allow-list →** add `https://portal.fourpielabs.com/**`
     (keep `https://fourpielabs-portal.vercel.app/**` and `http://localhost:3000/**`).
   - Email templates need **no change** — they use `{{ .SiteURL }}`.
4. **Vercel env:** set **`NEXT_PUBLIC_SITE_URL = https://portal.fourpielabs.com`** (Production)
   → **Redeploy**.
5. **Quick re-verify** on `https://portal.fourpielabs.com`: log in as each role; send one
   invite to a real address and confirm the email link lands on the new domain and completes
   set-password. (The Vercel URL keeps working unless you remove it.)

---

## Troubleshooting — email sending (SMTP)

The app now surfaces a **mapped, specific** error on invite/reset failures (e.g.
"SMTP authentication failed", "Sender domain not verified", "rate limit hit") and
writes **`user.invite_failed`** / **`password_reset.failed`** to the audit log with
the **raw error in `metadata`**. So first stop: **Admin → Audit**, filter by those
actions, read the raw message. Supabase frequently returns a generic
"Error sending invite email" to the API and keeps the real SMTP cause only in its
logs — so isolate with these three steps, in order:

1. **Dashboard-native send test** (is it the app or Supabase/SMTP?).
   Supabase → **Authentication → Users → Invite user** (or "Send magic link") to a
   real address straight from the dashboard. If the **dashboard send also fails**,
   the app is innocent — it's SMTP/Supabase config. If the dashboard send works but
   the app's doesn't, look at the app (env/redirect), not SMTP.
2. **Resend → Emails log** (did the message reach Resend, and what happened?).
   - **Nothing in the log** → Supabase never reached Resend: wrong SMTP host/port,
     or a bad/incorrect **API key** (SMTP auth). Recheck Supabase → SMTP Settings.
   - **Logged but failed/bounced** → it reached Resend but Resend rejected it:
     usually the **sender domain isn't verified** (`mail.fourpielabs.com`) or a bad
     recipient.
3. **Supabase → Authentication → Logs** (the exact SMTP error).
   Find the failed send and read the literal SMTP response (e.g. `535` auth failed,
   `550` domain/sender not allowed, `429` rate limited). That code tells you which
   of the above it is.

### ⚠️ Account-mismatch trap (the most common cause)
The Resend **API key must come from the exact Resend account/workspace where
`mail.fourpielabs.com` is verified.** A key generated in a *different* Resend
account will authenticate fine (SMTP login succeeds) but that account has **no
verified `mail.fourpielabs.com`**, so every send is rejected as
"domain not verified" — which looks like an app bug but isn't. Confirm in Resend
that the **verified domain and the API key live in the same account**, and that the
**Sender email** in Supabase SMTP Settings is `noreply@mail.fourpielabs.com` (a
subdomain of the verified domain).

---

## Security advisors (run regularly — after any schema/auth change)
Programmatic, no dashboard needed. Requires `SUPABASE_ACCESS_TOKEN` in your shell:

```bash
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/frmukrgjkhlpxplhzeqj/advisors/security" \
  | jq -r '.lints[] | "[\(.level)] \(.name): \(.title)"'
```
(PowerShell: `$tok = [Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN','User')`
then `curl.exe -s -H "Authorization: Bearer $tok" <url>`. Or use the Supabase MCP
`get_advisors` tool.) Swap `security` → `performance` for perf lints. Triage every
finding (fix or justify) and record it in **SECURITY.md**. Current accepted/fixed
findings are documented there.

---

## Performance note (from P6 Lighthouse, mobile)
- Login page: **Accessibility 96 · Best-practices 100 · SEO 91 · Performance ~28 (mobile, lab)**.
- Mobile performance is dominated by client JS (the Supabase auth client bundled into the
  login form + framework hydration). Real-world warm loads beat the throttled lab number.
- **Optional optimization** (deferred to avoid destabilizing the verified auth flow):
  move `/login` sign-in to a **server action** so `@supabase/supabase-js` isn't in the
  login first-load bundle. Re-Lighthouse after.
- **To Lighthouse the auth-gated pages** (dashboard, performance, team client-overview):
  sign in in Chrome, open **DevTools → Lighthouse**, run against the loaded page (uses your
  session cookies). Targets: a11y ≥ 95, best-practices ≥ 95, performance ≥ 50 (mobile).
