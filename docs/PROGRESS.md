# Progress

## Completed milestones
- Phase 0 — Discovery & plan: approved 2026-08-18 (with defaults; DECISIONS.md D1–D14).
- **M0 — Foundation** (2026-08-18): Next.js 16.3.1 / TS / Tailwind v4, RTL root, tokens, base components, Drizzle+PGlite fallback, Vitest+Playwright, CI, docs.
- **M1 — Domain core & schema** (2026-08-18): full schema + GiST no-overlap constraint, request/job state machines with guards, idempotent seeds (D1–D5 honored).
- **M2 — Staff auth & Pro shell** (2026-08-18): session auth, staff gate on every /pro page+action, settings CRUD (services/zones/availability) with audit.
- **M3+M4 — Booking wizard & assessment** (2026-08-19): 7-step guest flow with draft resume, photo pipeline, geo dev fallback, Lead exits; deterministic assessment (16 fixtures).
- **M5+M6 — Scheduling & status page** (2026-08-19): pure engine (10 fixtures incl. Scenario F), commit-time revalidation + exclusion race guard, slot picker, /s/[token] with full state mapping + approvals + completion summary.
- **M7+M8 — Pro Today & job runner** (2026-08-19): 10-step guided runner, 5-point safety checks, findings, in-person/link approvals (immutable), payment amount guard, visit-fee & unresolved endings (3 lifecycle integration tests).
- **M9+M10 — Requests, search & history** (2026-08-19): review inbox with manual pricing → booking link, leads, household search, bike cards, rebook prefill.
- **M11 — Manual calendar control** (2026-08-19): blocks (time/day/zone-day), manual booking, move/extend, operator cancel.
- **M12 — E2E & hardening** (2026-08-19): scenarios A–E green in Playwright (prod build, fresh DB, dedicated port); Scenario F covered by engine fixtures; no-internal-leak + 404 guard test; rate limiting on all public endpoints.

Design directive D16 applied across the app (2026-08-19): white background only, no emojis.

## Test inventory
- 53 unit/integration tests (Vitest): state machines (exhaustive transition tables + guards), assessment fixtures, scheduling fixtures, migrations + exclusion constraint, seeds, sessions, job lifecycle (Scenarios A/C/visit-fee at DB level).
- 7 E2E tests (Playwright, mobile viewport, production build): landing RTL smoke ×2, Scenario A+C, B, D, E, token guards.

## Current blockers / remaining before production launch
- **Credentials from Rancho** (docs/ROADMAP.md N): Supabase project + `DATABASE_URL`/keys, Vercel project, `AUTH_SECRET`, real staff password (`SEED_STAFF_EMAIL`/`SEED_STAFF_PASSWORD`), Google Maps API key (until then: dev geocode fallback), `NEXT_PUBLIC_RANCHO_PHONE`.
- **Price TBDs** (DECISIONS D1–D5): tire pricing semantics, small-wheel prices, cable/pedal part inclusion, final visit fee, per-zone travel charges.
- **Manual audits not yet run**: Lighthouse perf/accessibility thresholds (M12 acceptance), real-device iOS PWA camera check. Structure is in place; run before launch.
- P1 backlog per docs/ROADMAP.md (OTP/My-Bikes, WhatsApp API, routing provider, payments, inventory, waitlist…).

## Next task
P0 loop is complete. Next: Rancho's answers to the TBDs + production credentials → deploy; then P1 per roadmap.
