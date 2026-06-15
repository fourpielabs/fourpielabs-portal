# Phase 3 — Auth / data-model backlog (frozen-logic items)

These 3 audit findings were **deliberately NOT fixed** in the Phase 3 UI remediation
because they require frozen logic (server actions / RLS / schema / auth middleware).
They must be done in the **auth / data-model phase** with full security
re-verification (`npm run test:rls` must stay green, plus targeted auth-flow tests).

---

## #1 — Password-reset "set new password" form is unreachable (BLOCKER)
**Symptom:** clicking a password-reset link logs the user in but never lets them set a
new password — they land on `/dashboard`.
**Cause (code-reasoned; verify with a live token):** reset email →
`/auth/confirm?next=/accept-invite`; `verifyEmailOtpAction` establishes a **session**,
then `redirect("/accept-invite")`. The user now has a session, so the middleware rule
"authenticated user on an auth route → `/dashboard`" bounces them off the set-password
form before it renders.
**Files:** `lib/supabase/middleware.ts` (the auth-route bounce), `lib/actions/auth.ts`
(reset redirect target), `app/(auth)/accept-invite/page.tsx` (the set-password form).
**Fix direction (later):** allow the password-set route through middleware while a
recovery/invite session is active (e.g. a one-time `next`/recovery flag), or use a
dedicated `/reset-password` route excluded from the bounce. Re-verify the full reset +
invite flows end-to-end.

## #2 — Invite bypasses the prefetch-safe `/auth/confirm` interstitial (BLOCKER / security)
**Symptom / cause:** `sendInviteAction` sets `redirectTo: {siteUrl}/accept-invite`
(direct), while password-reset routes through `/auth/confirm?next=...`. The confirm
interstitial exists specifically so email-scanner prefetch can't burn the one-time
token (per CLAUDE.md). Invites skip it, so the invite token is consumed by the default
verify→GET path — defeating that protection and handling the same token inconsistently.
**Files:** `lib/actions/users.ts` (invite `redirectTo`), `app/auth/confirm/page.tsx`,
`app/(auth)/accept-invite/page.tsx`.
**Fix direction (later):** route invites through `/auth/confirm?next=/accept-invite`
like reset, and make the set-password form reachable per #1. Re-verify token can't be
burned by prefetch.

## #5 — Client cannot act on a "Needs review" deliverable (HIGH)
**Symptom:** a deliverable in `needs_review` shows the status to the client but offers
no way to approve / request changes / acknowledge — the status implies client action
the UI can't perform.
**Why frozen:** a client write path needs a **new server action + RLS policy** (clients
currently have exactly one write path, the checklist toggle). Out of scope for a UI pass.
**Files (later):** new action in `lib/actions/deliverables.ts` (client-scoped approve/
ack), an RLS policy on `deliverables`, plus the client UI in `app/(portal)/deliverables/page.tsx`.
**Note:** Phase 3 DID add the read-only "Waiting on client" banner on the client
dashboard (presentation only) so the client at least *sees* they're the blocker — but
the actual approve/ack control waits for this backlog item.
