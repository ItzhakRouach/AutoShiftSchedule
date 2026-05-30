# Architecture

System overview, data model, and how to run the database. The authoritative build sequence is
`IMPLEMENTATION_PLAN.md`; this file is the durable architecture reference.

## High level
Next.js App Router (RSC for reads, Server Actions + Zod for mutations) over Supabase Postgres with
Row-Level Security. Auth via Supabase (managers: email/password; employees: join by invite code). The
scheduling engine is a pure TypeScript module invoked from a Server Action. Scheduled jobs (Vercel Cron)
lock the request deadline and trigger publishing. Schedule images render via `@vercel/og` and are stored in
Supabase Storage.

## Running the database
- **Local (needs Docker):** `npx supabase start` then `npx supabase db reset` to apply migrations.
- **Cloud (no Docker):** create a free Supabase project, put its URL + keys in `.env.local`, and push
  migrations with `npx supabase db push` (after `supabase link`). Decision recorded per project setup.
- Env keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Data model (tables)
`organizations` · `workplaces` · `roles` · `employees` (user_id?, role_ids[], min_shifts_per_week,
observes_shabbat, observes_holidays, must_accept, status) · `shift_types` (8h base + 12h fallback variants) ·
`shift_requirements` (workplace × day-of-week × shift × role → count) · `schedule_periods`
(collecting/locked/published) · `requests` (per-day off/preferred shifts + vacation ranges) · `assignments`
(employee, period, date, shift_type, role, source) · `holidays` (auto-filled, editable) · `invites`
(code, expiry) · `workplace_settings` (request_deadline, publish_day, min_rest_hours, allow_12h_fallback,
greenapi config).

All tables: **RLS** scoped by org/workplace membership. Migrations are forward-only in `supabase/migrations/`.
Defaults (roles, shift_types) are seeded on workplace creation, not via migration.
