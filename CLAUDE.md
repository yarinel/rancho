# Rancho RideCare

Hebrew-first, RTL-first mobile web app + field-service OS for Rancho (רנצ'ו) — a
one-technician home-visit bicycle repair business in the Be'er Sheva area. The
parent books and pays; the rider owns the experience; the bicycle owns the
service history. Primary operational object: **Service Job** (not appointment).
North star: **First Visit Resolution** — ready before we arrive.

## Source of truth

- Business/brand spec: "רנצ'ו איפיון צאט.pdf"; price list: "רנצ'ו תיקוני אופניים - מחירון.pdf" (both in ~/Downloads; distilled into docs/).
- Approved Phase 0 plan: docs/ROADMAP.md is the execution contract; docs/DECISIONS.md logs every deviation.

## Non-negotiables

1. Customer UX is Hebrew + RTL from the start — never build LTR and flip.
2. Guest booking: no customer passwords, ever.
3. Journey starts from the customer's problem, not service terminology.
4. Every completed repair includes the 5-point safety workflow (crank, stem/handlebar, wheels/axles, brakes, gears-if-present). N/A allowed only for GEARS on gearless bikes. Software never certifies safety — the technician does.
5. Price changes discovered on site require recorded customer approval BEFORE the work; final amount can never exceed the approved total (ApprovalRecord guard). Approvals are immutable.
6. Services, prices, zones = admin-editable data, never hardcoded in components.
7. Operator keeps manual calendar control; scheduling suggestions never remove it.
8. No fake integrations — missing credentials ⇒ clearly labeled dev adapters (e.g., PGlite DB fallback, console notifications, copy-to-WhatsApp).
9. State transitions go through the domain layer (`src/domain`); UI never mutates status directly.

## Architecture (details: docs/ARCHITECTURE.md)

- Next.js (App Router) + TypeScript + Tailwind v4, single modular monolith.
- Surfaces: `/` + `/book` + `/s/[token]` (customer), `/pro/*` (staff, server-side auth gate on every route AND action).
- Postgres via Drizzle (SQL migrations in `/drizzle`). `DATABASE_URL` = Supabase; unset ⇒ PGlite dev fallback (real Postgres/WASM, `.data/pglite`).
- Pure domain logic in `src/domain/*` — no framework imports, unit-tested.
- Provider adapters for maps/notifications/travel/payments; never call vendors from components.

## Commands

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` · `npm run typecheck` · `npm run test` (Vitest) · `npm run e2e` (Playwright, mobile profile, needs `npm run build` first)
- `npm run db:generate` (drizzle-kit) · `npm run db:migrate`

## Working rules

- One milestone at a time (docs/ROADMAP.md); meet its acceptance criteria, update docs/PROGRESS.md, STOP before the next.
- Tests are part of every feature; never delete tests to make things pass.
- RTL: use logical properties/Tailwind logical utilities only (`ps-`, `me-`, …); mixed Hebrew/English strings (BMX, 20", ₪) need explicit direction care.
- Customer-facing copy: short, eye-level, friendly Hebrew (docs/BRAND.md); functional surfaces stay plain and readable — brand "poster" styling only in heroes/confirmations.
- Data minimization for children: no DOB anywhere; rider = optional first name + age range.
- Prices marked TBD in docs/DECISIONS.md (tire pricing, visit fee, travel surcharges) stay QUOTE/configurable until Rancho confirms values.
