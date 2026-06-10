# 4Pie Labs — Client Portal

Private, invite-only client portal for 4Pie Labs. Next.js 15+ (App Router, TS,
Server Components), Tailwind + shadcn/ui, Supabase (Postgres + Auth + Storage +
RLS). See [`PORTAL_SPEC.md`](./PORTAL_SPEC.md) for the full spec and
[`CLAUDE.md`](./CLAUDE.md) for the working summary.

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill with the 4Pie Labs Supabase values
npm run dev
```

## Database

Migrations live in [`supabase/migrations`](./supabase/migrations) and are applied
with the Supabase CLI (linked to the fourpielabs project):

```bash
supabase db push     # apply migrations to the linked project
supabase db reset    # rebuild a local DB from scratch (verifies migrations)
```

Never make ad-hoc schema changes — migrations only.

## Deploy

Push to `main` → Vercel auto-deploys. Production: `portal.fourpielabs.com`.
