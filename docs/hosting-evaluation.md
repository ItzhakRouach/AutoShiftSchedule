# Hosting Evaluation — Cloudflare Pages vs Vercel

**Status:** evaluation only — no migration performed. Decide before any move.
**App:** Next.js 16 (App Router, React 19) + Supabase (`@supabase/ssr`), PWA.

## What this app actually needs from a host

| Capability | Where it's used | Notes |
|------------|-----------------|-------|
| **Scheduled jobs (Cron)** | `vercel.json` → `/api/cron/lock-deadline` (daily 02:00) and `/api/cron/publish` (daily 05:00). Auth via `CRON_SECRET`. | 2 daily jobs. Hobby plan = once/day max. |
| **OG image generation** | `/api/schedule-image/[periodId]/route.tsx` via `@vercel/og` (`runtime = 'nodejs'`) — renders the weekly schedule PNG shared on WhatsApp. | Node runtime today. |
| **Node.js server runtime** | All API routes + Server Actions + RSC. Cron routes set `runtime = 'nodejs'`. | Engine is pure TS; no native deps. |
| **Session middleware** | `src/proxy.ts` (Next 16 `proxy`) refreshes the Supabase session cookie. | Runs on every request. |
| **Env / secrets** | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_BASE_URL`. | Standard. |
| **Static + PWA assets** | `app/manifest.ts`, `public/sw.js`. | Either host serves these well. |

Supabase is the database/auth/storage in both cases — hosting choice does **not** touch it.

## Vercel (current)

- **Cron:** native (`vercel.json crons`). Zero migration. Hobby = 1 run/day (already the cadence).
- **OG image:** `@vercel/og` is first-party; works as-is on the Node runtime.
- **Next 16 / proxy.ts / `@supabase/ssr`:** the reference platform — fully supported, no adapter.
- **DX:** push-to-deploy, preview URLs per PR, env management in dashboard/CLI. Lowest friction.
- **Cost:** Hobby (free) covers this app's scale (small security teams). Active-CPU pricing if it grows.
- **Effort to stay:** **zero.**

## Cloudflare Pages + Workers

- **Cron:** not in Pages config — needs **Cron Triggers** on a **Worker**, plus wiring the trigger to hit the two routes (or porting the job logic into the Worker). Re-implementation + re-testing of the auth-guarded jobs.
- **OG image:** `@vercel/og` is **not** supported. Must swap to **`workers-og`** (Satori-based) or Cloudflare Browser Rendering. The route (`route.tsx`) needs rewriting and visual re-verification of the shared PNG.
- **Next 16 adapter:** requires **`@cloudflare/next-on-pages`** or **OpenNext for Cloudflare**. App Router + RSC + Server Actions support has historically lagged the latest Next release; Next 16 compatibility must be verified before committing. Some Node APIs run on `nodejs_compat`.
- **`src/proxy.ts` middleware:** must run on Cloudflare's edge/runtime via the adapter — verify `@supabase/ssr` cookie refresh works there.
- **DX:** good (Git integration, preview deployments), but the adapter adds a build step and a class of "works on Vercel, breaks on CF" issues to debug.
- **Cost:** Workers/Pages free tier is generous; could be marginally cheaper at scale.
- **Effort to migrate:** **significant** — adapter adoption, Cron re-architecture, OG replacement, full re-test of cron + image + auth flows.

## Recommendation

**Stay on Vercel for now.** The app uses three Vercel-native capabilities (Cron, `@vercel/og`, Next 16 + proxy.ts) that all "just work" today; migrating trades a working setup for adapter risk and re-implementation of the cron + OG paths, with no clear win at this app's scale (free tier suffices on either). Speed differences for a Supabase-backed, server-rendered app are dominated by DB round-trips, not the host.

**Revisit Cloudflare only if** a concrete trigger appears: Vercel cost becomes material at scale, or a need arises for Cloudflare-specific features (e.g. global edge KV, R2, very high traffic). If so, scope a migration spike:

1. Stand up `@cloudflare/next-on-pages` (or OpenNext) on a branch; confirm Next 16 + RSC + Server Actions + `src/proxy.ts` + `@supabase/ssr` all work.
2. Replace `@vercel/og` with `workers-og`; visually diff the schedule PNG.
3. Re-implement the two cron jobs as Cron-Triggered Workers; re-run `route.test.ts` equivalents.
4. Verify env/secrets and the `CRON_SECRET` auth guard.

> If the decision flips to Cloudflare, update `CLAUDE.md` (Stack/Hosting) and the saved project memory, which currently lock Vercel.
