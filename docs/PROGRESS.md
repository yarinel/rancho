# Progress

## Completed milestones
- Phase 0 — Discovery & plan: approved 2026-08-18 (with defaults; see DECISIONS.md).

## Current milestone
**M0 — Foundation** (complete — all acceptance criteria verified 2026-08-18)
- [x] Repo + Next.js 16.3.1 / React 19 / TS / Tailwind v4 scaffold (npm, Node 24)
- [x] RTL root (`lang="he" dir="rtl"`), fonts (Karantina display / Noto Sans Hebrew UI)
- [x] Design tokens v1 (`src/app/globals.css`) — light customer surface, `.surface-pro`, `.surface-poster`
- [x] Base components: Button, Card, Chip, Input (logical properties, ≥48px targets, focus rings)
- [x] Landing (`/`) + `/book` placeholder
- [x] Drizzle + migrations (`/drizzle`), Supabase-or-PGlite driver selection, `db:generate`/`db:migrate`
- [x] Vitest: clean-DB migration test passing
- [x] Playwright (Pixel 7 mobile, prod build): RTL/CTA smoke + no-horizontal-scroll — passing
- [x] GitHub Actions CI (lint, typecheck, unit, e2e)
- [x] Docs: CLAUDE.md, docs/* (PRODUCT, BRAND, UX, DATA_MODEL, STATE_MACHINES, SCHEDULING, ARCHITECTURE, ROADMAP, DECISIONS, PROGRESS)

## Current blockers
- None for M1. Before M3: Google Maps API key. Before launch: price TBDs (DECISIONS D1–D5).

## Next task
M1 — Domain core & schema (awaiting explicit go-ahead per the milestone execution rule).
