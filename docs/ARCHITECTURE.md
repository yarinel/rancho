# Architecture

System architecture for Rancho RideCare: what is **implemented now (M0)** and what is **planned** per the approved Phase 0 plan (section J, approved 2026-08-18 with defaults). One deployable Next.js modular monolith, three surfaces — customer `(customer)`, staff `(pro)`, `api` — all Hebrew/RTL. Every mutation passes through the domain layer; no queues, workers, or microservices in P0 (nothing needs asynchrony a request cycle can't provide).

Related docs: `DATA_MODEL.md` (entities), `SCHEDULING.md` (engine + extension points), `BRAND.md` (tokens), `DECISIONS.md`.

## Stack as implemented (M0)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js **16.3.1** (App Router) + React **19.2.8** + TypeScript 5 | Server Components + server actions. PWA target; no native app. |
| Styling | Tailwind CSS **v4** (`@tailwindcss/postcss`) | Design tokens v1 in `src/app/globals.css` (price-list black/fuchsia/white identity per decision C1). RTL-native: `dir="rtl"` on the root, logical properties only. Fonts via `next/font`: Noto Sans Hebrew (UI), Karantina (display). |
| ORM / migrations | Drizzle ORM **0.45** + drizzle-kit; SQL migrations in `/drizzle` | `dialect: postgresql`, schema at `src/db/schema.ts`. M0 schema is a single `app_meta` bootstrap table proving the pipeline; domain entities land in M1. `npm run db:generate` / `npm run db:migrate`. |
| Package manager / runtime | npm, Node **24** (CI) | |
| Unit/integration tests | Vitest 4 (`src/**/*.test.ts`, node environment, `@` → `src` alias) | Domain tests must run framework-free in milliseconds. |
| E2E | Playwright, single **Pixel 7** mobile project; `webServer` runs the **production build** (`npm run start`) so CI verifies what ships | `e2e/landing.smoke.spec.ts` is the M0 smoke. |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | Job `checks`: lint, typecheck, vitest. Job `e2e`: `next build` + Playwright (chromium). Both on push and PR, Node 24. |
| Validation | Zod 4 | |

### Database access (implemented: `src/db/client.ts`, `src/db/migrate.ts`)

`createDb()` returns `{ db, driver }`:

- `DATABASE_URL` set → `postgres-js` driver against Supabase Postgres (`prepare: false`).
- No `DATABASE_URL` → **PGlite** fallback: real Postgres via WASM, persisted under `.data/pglite` (override with `PGLITE_DIR`). This is a *labeled dev fallback, not a mock* — `runMigrations()` applies the same `/drizzle` SQL folder on both drivers (per-driver Drizzle migrators). This honors the no-faked-integrations rule: absent credentials ⇒ clearly labeled real adapters.

## Planned layers (from plan §J — not yet built unless noted)

### Domain layer — `src/domain/*` (M1+)
Pure TypeScript: state machines (`transition(entity, event, actor, data)` with allowed-transitions tables and guards), scheduling (`src/domain/scheduling`, M5), pricing, assessment (M4). Zero framework imports; all non-negotiables (safety-check completeness, payment amount guard, approval guards) live here as guards, not UI conventions. Every transition appends a DomainEvent.

### Database — Supabase Postgres (M1)
- Drizzle SQL-first migrations, incl. the `btree_gist` extension for the Appointment exclusion constraint (`technician, tstzrange(block_start, block_end) && WHERE status='ACTIVE'`) — the double-booking guard lives in the schema.
- JSONB + `schema_version` for intake answers; relational for everything operational.
- RLS as defense-in-depth; authorization enforced in the server layer.
- `DomainEvent` append-only table powers the status page, audit, and metrics (the analytics seed — no vendor).

### Authorization (M2)
- **Staff**: Supabase Auth. P0 = a **single authenticated-staff gate** on every `/pro` route AND server action. The `Technician.role` column exists but is **dormant**; role-differentiated checks are an extension point (multi-technician + role-based auth is P2).
- **Customers**: guest-first, no accounts, **no passwords ever**. Per-job unguessable 128-bit status tokens (`/s/[token]`), rate-limited. OTP/magic-link arrives in P1 on the same primitives.

### Media pipeline (M3)
Supabase Storage, private bucket, server-issued signed upload/read URLs. Client-side compression (~1600px) before upload, with progress and retry. Images only in P0; `Media.kind` supports VIDEO later (P1 video intake).

### Provider adapters
All external capabilities sit behind interfaces; absent credentials get clearly labeled dev adapters, never fakes.

| Adapter | P0 implementation | Later swap |
|---|---|---|
| `GeoProvider` (M3) | Google Maps Platform — Places Autocomplete (New) + Geocoding (best Hebrew/IL coverage; owner's key + billing, per O7 default). Dev fallback: free-text address + manual zone pick, clearly labeled. | Provider swap behind the interface. |
| `TravelEstimator` (M5) | Haversine × road factor ÷ configurable speed + per-zone buffer. | Real routing/ETA provider in P1. |
| `NotificationProvider` (M6) | Consumes DomainEvents. P0 channels, all real: the status page itself (renders from the event log), `DevConsoleProvider`, operator copy-to-WhatsApp buttons. **No outbox table or cron in P0** — deferred to P1 with the first real delivery channel (WhatsApp BSP/SMS); the interface + event log make it a drop-in. | WhatsApp Business API + SMS (P1). |
| Payments | Recorded states only (`PENDING`/`PAID_CASH`/`PAID_BIT`/`PAID_TRANSFER`/`PAID_EXTERNAL`/`WAIVED`), marked by the technician. Provider abstraction documented, **not built** — no payment provider tables in P0. | Bit for business / Grow / Meshulam / PayPlus — P1 business decision. |

### Observability (M12)
Structured logs with zero PII; DomainEvent table doubles as analytics; Sentry optional.

## Deliberately not in P0 (documented extension points)
- Inventory table (actual parts = JobLineItem chips; scheduling inventory constraint named in `SCHEDULING.md`).
- Notification outbox + cron polling (P1).
- Payment provider tables (P1).
- Multi-technician routing (P2); the domain model is multi-tech-ready (A3) without building it.
- Automated overrun re-optimization (P1; P0 is manual notify/move).

## Tradeoffs & lock-in mitigations
- **Supabase vs bare Postgres**: buys auth/storage/managed DB for a solo project. Lock-in mitigated by the pure domain layer + portable SQL migrations — and demonstrated in practice by PGlite running the identical migrations.
- **Next.js vs Remix/SvelteKit**: ecosystem and PWA maturity.
- **Drizzle vs Prisma**: transparent SQL migrations, lighter runtime.
- **No queues/workers/microservices**: nothing in P0 needs them.
- **Vercel + Supabase hosting** (O8 default): solo-dev bus factor countered by docs discipline and a boring stack.

## Environment
See `.env.example`. `DATABASE_URL` (Supabase Postgres) — optional locally (PGlite fallback). Google Maps key required at M3. Supabase URL + keys required for auth/storage from M2/M3.
