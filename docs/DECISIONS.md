# Decision Log

Concise, append-only. Format: date · decision · why.

- **2026-08-18 · Phase 0 plan approved with defaults.** Owner replied "approved" to the full A–P plan without overriding defaults. Consequences below.
- **2026-08-18 · D1: Tire-replacement pricing parked as QUOTE** (open question O1: 120₪ all-inclusive vs 120₪ + 45₪ tire). Not seeded as instant-book; needs Rancho's answer.
- **2026-08-18 · D2: Wheel sizes outside 20"–26" price as MEDIUM confidence 80–110₪** until Rancho confirms exact prices (the price list only covers 20"–26").
- **2026-08-18 · D3: Cable/pedal prices assumed to include the standard part** — flagged, reversible in catalogue config.
- **2026-08-18 · D4: Visit/diagnosis fee placeholder 60₪, credited against same-visit repair** — configurable; final value TBD by Rancho (spec range 50–60₪).
- **2026-08-18 · D5: Non-B7 travel surcharges unset** — zones show MEDIUM price confidence with "כולל הגעה — נאשר סופית בתיאום" until flat amounts arrive.
- **2026-08-18 · D6: Brand direction = price-list identity** (black / fuchsia #ff2d87 / white, street energy) over the spec's "ורוד עדין + לבן קרמי" text; cream survives as secondary surface tint. Source conflict C1 resolved per Master Brief's designation of the price list as the visual reference.
- **2026-08-18 · D7: Maps provider = Google Maps Platform** (Hebrew coverage); dev fallback = free-text address + manual zone pick. API key needed at M3.
- **2026-08-18 · D8: Stack = Next.js + Supabase + Vercel,** Drizzle ORM, npm, Node 24. Scaffolded at Next.js 16.3.1 / React 19 / Tailwind v4.
- **2026-08-18 · D9: Local/CI database = PGlite** (real Postgres via WASM) when `DATABASE_URL` is unset — no Docker/Postgres on the dev machine, and CI needs no services. Same Drizzle migrations run on Supabase in production. Labeled dev fallback, not a mock.
- **2026-08-18 · D10: Playwright mobile profile = Pixel 7 (Chromium)** — WebKit not installed locally/CI; iOS-specific quirks (PWA camera etc.) get real-device verification at M3/M12 per plan.
- **2026-08-18 · D11: `follow_up_required` is a job flag, not a state**; follow-up visits are new jobs linked via `originating_job_id`. Resolves the plan-review contradiction.
- **2026-08-18 · D12: Automated overrun re-optimization deferred to P1.** P0 ships at-risk flags + one-tap notify/move, and same-day slot generation uses projected end times.
- **2026-08-18 · D13: Inventory table deferred to P1.** Actual parts recorded as line-item chips; scheduling inventory constraint documented as a named extension point.
- **2026-08-18 · D14: P0 authorization = single staff gate**; role column exists but role-differentiated checks deferred (one human operates today).
- **2026-08-18 · D15: Fonts self-hosted via Fontsource** (@fontsource/karantina, @fontsource/noto-sans-hebrew) instead of next/font/google — the Google fetch at compile time broke the dev server offline and is a CI flakiness source. Same OFL faces, deterministic builds.
- **2026-08-19 · D16: Owner directive — no emojis anywhere; white background only.** All surfaces (customer + Pro) now use the white token set; `.surface-pro`/`.surface-poster` kept as neutralized extension points. Supersedes the dark-Pro and cream-customer moods from D6's original token draft; brand energy carried by the fuchsia accents and the logo asset.
