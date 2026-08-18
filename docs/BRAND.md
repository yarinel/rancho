# BRAND.md — Digital Interpretation of the Rancho Brand

Sources: the 26-page business/brand spec and the 1-page graphic price list. Governs all customer-facing and Pro UI. Color direction resolved per decision C1 (plan approved 2026-08-18 with defaults). Tokens below are v1, implemented in `src/app/globals.css`.

## 1. Brand essence

- Compass word: **אחריות**. "המכונאות היא הבסיס. הרכיבה היא הלב. האחריות היא המצפן."
- Tagline: "רנצ׳ו קיים כדי שתמשיכו לרכוב". Price-list strip: "פנצ'ר? תיקון? טיפול? שב בכייף אנחנו בדרך". Header line: "פשוט. מהיר. עד אליך."
- Pillars: מקצועיות, בטיחות, שקיפות, תרבות רכיבה.
- Emotional targets: parent — "זהו, מצאתי פתרון"; child — "בא לי לרכב".
- Graphic signature: gear wheel + chain.
- The product is not a poster: street energy never outranks readability, prices, or safety content.

## 2. Voice

Tone words (spec p7): **מקצועי, אמין, רגוע, מגניב.**

Rules:
- Short, eye-level, confident, friendly — never condescending. Reference register: "בדוק אחי, זה שלך."
- **Bad news stated plainly**, always in this shape: where the problem is → implications if untreated → the solution → the cost. No drama, no scare tactics.
- Street slang is **seasoning, not the base**. Functional copy (prices, approvals, safety) stays plain; slang appears only in brand moments.
- Never surprise on price after work; transparency copy is part of the voice ("אם נגלה משהו נוסף — נסביר, נתמחר, ולא נעבוד בלי אישור שלכם.").
- Customer UI is Hebrew-only in P0; internal state names never leak to customers (see the mapping table in the plan / status page).

## 3. Color: the C1 conflict and its resolution

**Conflict.** Spec p17 prescribes "ורוד עדין + לבן קרמי" and says to avoid loud/hot colors. The actual price-list artifact — the newer produced artifact, named by the Master Brief as the practical visual reference — is black + loud hot fuchsia + white with distressed urban texture.

**Resolution (C1, approved with defaults 2026-08-18).** The price-list identity wins: **black / fuchsia / white street energy** is the brand palette. The spec's creamy white survives as a secondary nod — a cream tint for soft/secondary customer surfaces (the default light background). Delicate pink survives only as `--rancho-pink-soft` for soft brand fills.

## 4. Design tokens (as implemented in `src/app/globals.css`)

Brand palette:

| Token | Value |
|---|---|
| `--rancho-black` | `#0d0d0d` |
| `--rancho-ink` | `#1a1a1a` |
| `--rancho-pink` | `#ff2d87` |
| `--rancho-pink-strong` | `#e0176e` |
| `--rancho-pink-soft` | `#ffe3f0` |
| `--rancho-white` | `#ffffff` |
| `--rancho-cream` | `#faf6f2` |
| `--rancho-gray` | `#6b6b6b` |
| `--rancho-gray-soft` | `#e8e4e1` |

Safety semantics — **never overloaded with brand pink**; these colors are reserved for safety-check results and findings severity:

| Token | Value |
|---|---|
| `--safety-ok` | `#1a9e55` |
| `--safety-attention` | `#d97a00` |
| `--safety-unsafe` | `#d32f2f` |

Semantic surface tokens (light/customer defaults on `:root`; components consume only these, never raw palette values):

| Token | Default |
|---|---|
| `--color-bg` | `--rancho-cream` |
| `--color-surface` | `--rancho-white` |
| `--color-ink` | `--rancho-ink` |
| `--color-ink-muted` | `--rancho-gray` |
| `--color-border` | `--rancho-gray-soft` |
| `--color-brand` | `--rancho-pink` |
| `--color-brand-strong` | `--rancho-pink-strong` |
| `--color-brand-soft` | `--rancho-pink-soft` |
| `--color-on-brand` | `--rancho-white` |

Shape, elevation, interaction:

| Token | Value |
|---|---|
| `--radius-card` | `1rem` |
| `--radius-control` | `0.75rem` |
| `--shadow-card` | `0 2px 12px rgb(13 13 13 / 0.08)` |
| `--focus-ring` | `0 0 0 3px color-mix(in srgb, var(--rancho-pink) 45%, transparent)` |
| `--tap-min` | `3rem` (48px minimum touch target) |

All semantic tokens (plus `--color-safety-*`, radii, and fonts) are exposed to Tailwind v4 utilities via `@theme inline`.

## 5. Surface moods (one token set, three moods)

- **Customer default (`:root`)** — light "paper": cream background, white cards, dark ink. Chosen for maximum readability of forms, prices, and scheduling.
- **`.surface-pro`** — Rancho Pro: black background, `#171717` cards, `#f5f5f5` ink, high contrast, sunlight-legible. Dark because it is the operator's outdoor tool, not because it is a poster.
- **`.surface-poster`** — brand poster moments: black background, white ink. Opt-in only.

The rule: **poster surfaces carry brand energy; functional surfaces carry information.** Overriding the semantic tokens per surface class — never restyling components — is how a component works on all three.

## 6. Typography

- **UI face: Noto Sans Hebrew** (OFL) — all functional text. Loaded via `next/font/google` in `src/app/layout.tsx` as `--font-ui`; the `body` default.
- **Display face: Karantina** (OFL) — the price-list-energy display voice. Loaded as `--font-display`; applied only via the opt-in `.font-display` class. **Display type is never the default for functional text.**
- Licensing note: the poster's exact typeface was never identified and must not be assumed. Karantina is the approved OFL substitute (per integration table N: license the original face if purchased, or approve the OFL substitute). Revisit only if the original face is identified and licensed — display use only.

## 7. Brand moments — allowed vs forbidden

Allowed (poster energy, `.surface-poster` + `.font-display`, still restrained):
- Landing hero ("פנצ'ר? תיקון? טיפול? שב בכייף, אנחנו בדרך.").
- Booking confirmation — explicitly a *restrained* brand moment.
- Completion / "מוכן לרכיבה 🤘" celebration on the status page.
- Empty states.

Forbidden (functional surfaces — plain voice, paper or pro mood, UI face):
- Booking wizard questions, intake, photos, location, contact forms.
- Anything showing a price, range, assessment, or approval — transparency copy must be maximally legible.
- Slot selection and scheduling.
- Safety-check UI, findings, red-flag explanations — safety colors only, never brand pink for status meaning.
- The entire Pro job runner and calendar (dark, but functional, not poster).
- Error, decline, out-of-scope, and bad-news screens — honest and plain, no street styling on disappointment.

## 8. Accessibility commitments

- **WCAG AA intent** across both surfaces; M12 gate: Lighthouse mobile accessibility ≥ 90 on the booking flow (also measured on `/pro`).
- Contrast: functional text on paper (dark ink on cream/white) and on pro (near-white on near-black) is high-contrast by construction; brand pink is an accent and action color, not a body-text color.
- Touch targets: `--tap-min` = 48px minimum everywhere; Pro targets sized for outdoor, gloved, one-handed use.
- Focus: `:focus-visible` gets the `--focus-ring` pink ring globally (outline replaced, never removed without replacement).
- RTL-native: `dir="rtl"` root, logical properties only; dedicated M12 audit for mixed Hebrew/English strings (BMX, 20") and ₪ rendering.
- Safety status is never conveyed by color alone — results are always labeled (תקין / מומלץ לטפל / לא בטוח).
