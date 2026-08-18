# UX — Information Architecture & Interaction Rules

Source of truth: approved Phase 0 plan (2026-08-18, approved with defaults). Covers plan sections D (routes), G (customer journey), H (Rancho Pro journey), plus interaction rules and edge screens. All customer-facing copy below is proposed Hebrew copy from the plan — Hebrew-only UI in P0, RTL throughout. Status: M0 (foundation) in progress; screens listed here land across M3–M11.

## 1. Route map

One deployable app, three route groups, all Hebrew/RTL.

### Customer surface (mobile-first PWA, guest-first)

| Route | Purpose |
|---|---|
| `/` | Landing: brand moment + single CTA "מה קרה לאופניים?" (+ price list, WhatsApp fallback) |
| `/book` | Conversational booking wizard — client-side steps, server-persisted draft, resumable |
| `/s/[token]` | Tokenized per-job status page (no login): live status, appointment window, approval prompts, completion summary, "קבעו תיקון נוסף" re-booking CTA, change/cancel contact affordance |
| `/s/[token]/approve/[approvalId]` | Additional-work approval screen |
| `/my-bikes` | P1 (OTP). P0 ships the data model + the completion/history view reachable via token |

### Rancho Pro surface (staff auth, mobile-first, outdoor-usable)

| Route | Purpose |
|---|---|
| `/pro` | Today: ordered job cards + at-risk indicators + primary actions |
| `/pro/jobs/[id]` | Job detail & stage runner (10-step protocol as a guided flow, incl. cancel/unresolved outcomes) |
| `/pro/requests` | Service Request inbox (review → clarify → price → convert to booking offer) |
| `/pro/calendar` | Day/week; blocks (time/day/zone-day), manual bookings, move/extend/cancel |
| `/pro/search`, `/pro/customers/[id]` | Minimal household lookup by phone/name → contacts, riders, bikes, locations, jobs (thin P0) |
| `/pro/bikes/[id]` | Bike card: identity, photos, history, unresolved flags |
| `/pro/settings/services` · `/pro/settings/zones` · `/pro/settings/availability` | All operational config editable without deploys |

### System

`/api/*` route handlers (uploads, geocode proxy). No separate admin app; nothing operational is code-only.

## 2. Interaction rules

Apply everywhere, both surfaces:

- **One question per screen** in the booking wizard; progress dots.
- **Chips over typing**: large tappable cards/chips for every choosable answer; free text is the exception. Pro side: catalogue chips, toggle rows, minimal typing.
- **Every path has "לא יודע"** in guided intake; ambiguity routes to the Service Request path, never to a guess.
- **Photos are skippable** ("אפשר גם בלי, נסתדר") — skipping lowers assessment confidence, never blocks.
- **Back always works**; draft survives refresh (anonymous server-persisted draft from step 2, attached to the Household at the contact step).
- **Large tap targets**; Pro theme is dark, high-contrast, for outdoor use.
- **RTL-native**: `dir="rtl"` root, logical properties only; mixed Hebrew/English strings (BMX, 20") and ₪ rendering get a dedicated audit (M12).
- **Never a dead end**: every exit (out-of-scope, out-of-zone, no slot, stale slot) lands on an honest screen with a next action.
- **No internal state names leak** to customers — only the mapping table in §3.12.
- **Copy voice**: short, eye-level, confident, friendly; bad news stated plainly (problem, implication, solution, price) without drama.

## 3. Customer journey (screen-by-screen)

Symptom-first, guest-first. No password, no required email, ≤7 screens; everything skippable except problem + location + phone.

1. **Landing** — hero: logo, "פנצ'ר? תיקון? טיפול? שב בכייף, אנחנו בדרך." CTA: "מה קרה לאופניים?" Secondary: מחירון, WhatsApp.
2. **Problem** — "מה קרה לאופניים?" Cards: יש פנצ'ר / הגלגל ריק · הבלמים לא עובדים טוב · ההילוכים לא עובדים טוב · השרשרת נופלת · משהו רופף או מרעיש · צריך טיפול כללי · אני לא יודע מה הבעיה.
3. **Bicycle** — "ספרו לנו על האופניים": category cards (אופני ילדים, BMX, הרים, עיר, כביש, אחר); wheel size with "לא יודע" + helper "איפה כתוב על הצמיג"; optional brand; optional "מי רוכב עליהם?" (first name → Rider). Early exits: אופניים חשמליים and אופני כביש → out-of-scope screen (§5). אחר routes to the Service Request path, never instant-book. Returning customers (P1 OTP / token re-entry): "על איזה אופניים עובדים הפעם?" with saved cards + "+ אופניים אחרים".
4. **Guided intake** — 2–4 symptom-specific chip questions. Puncture: קדמי/אחורי/לא בטוח · האוויר יורד לאט או מיד? · רואים נזק בצמיג עצמו? Brakes: קדמי/אחורי/שניהם · חלש? משפשף? הידית מגיעה עד הכידון? Gears (sets `has_gears`): קופצים? לא עוברים? השרשרת נופלת? Every path has "לא יודע". Suspension-adjacent answers route to Service Request.
5. **Photos** — "תראו לנו רגע": overall side photo + close-up of the problem. Camera-first, client compression, progress, retry, skippable.
6. **Location** — "איפה אנחנו פוגשים אתכם?" Hebrew address autocomplete, zone resolved silently, access notes ("קומה? שער? חניה?"). Out-of-zone → §5.
7. **Contact** — name + mobile. Bootstraps the Household; earlier draft answers attach here.
8. **Assessment** — by confidence:
   - HIGH: "נראה כמו פנצ'ר קלאסי. החלפת פנימית — 80₪, בערך חצי שעה אצלכם בבית."
   - MEDIUM: "80–110₪, נדע בדיוק אחרי שנראה."
   - LOW → Service Request branch: "רוצים שנציץ בזה לפני שנתאם? אנחנו עוברים על התמונות וחוזרים אליכם עם מחיר וזמן — בדרך כלל תוך כמה שעות." (Concierge, not rejection.)
   - Non-B7 travel charge itemized here. Until per-zone amounts are set (TBD T2), non-B7 zones show MEDIUM confidence with "כולל הגעה — נאשר סופית בתיאום".
9. **Slots** (instant-book path) — "מתי נוח לכם שנגיע?" 3–5 ranked windows ("היום · 17:00–17:30") + optional preference chip (בוקר/אחה"צ → `time_preference`), then "מעדיפים זמן אחר?" → compact strip of eligible windows only.
10. **Review** — one card: bike, problem, place, window, expected service + price/range, travel line when applicable, contact. Note: "אם נגלה משהו נוסף — נסביר, נתמחר, ולא נעבוד בלי אישור שלכם." CTA: "סגרו לנו את זה".
11. **Confirmation** — restrained brand moment: what, where, when, price expectation, what happens next, add-to-calendar, status link ("שומרים את הקישור — כל העדכונים שם"). Stale slot at confirm → §5.
12. **Status page** (`/s/[token]`) — customer-language timeline plus change/cancel affordance ("צריכים לשנות או לבטל? דברו איתנו" → WhatsApp/phone deep link).

**Internal state → customer status mapping** (M6 builds exactly this table; every reachable state must render a defined text — snapshot-tested):

| Internal | Customer sees |
|---|---|
| DRAFT / request NEW·NEEDS_REVIEW | קיבלנו! אנחנו על זה |
| NEEDS_CUSTOMER_INFO | חסר לנו פרט קטן — תציצו בהודעה |
| READY_TO_BOOK | יש לנו הצעה בשבילכם — בחרו זמן |
| SCHEDULED (day before: reminder variant) | נקבע · מחר אנחנו אצלכם |
| RESCHEDULED | עדכנו את המועד |
| EN_ROUTE | רן בדרך אליכם |
| ARRIVED / INSPECTION | הגענו · בודקים את האופניים |
| AWAITING_APPROVAL | מצאנו משהו — מחכה לאישור שלכם |
| IN_SERVICE / FINAL_SAFETY_CHECK | עובדים על זה |
| PAYMENT_PENDING | סיימנו — סוגרים חשבון |
| COMPLETED | מוכן לרכיבה 🤘 |
| UNRESOLVED | לא הסתדר הפעם — דברו איתנו ונסגור את זה |
| CANCELLED | הביקור בוטל |

Post-completion, the page becomes the summary: מה עשינו, בדיקת הבטיחות, מה אישרתם בנוסף, לפני/אחרי, כמה יצא, טיפ תחזוקה — plus "קבעו תיקון נוסף" (P0 returning path: seeds bike + location into `/book` from the token).

**Service-request path** replaces steps 9–11 with: "קיבלנו! אנחנו בודקים את זה בשבילכם" → operator review → customer receives the booking link (status READY_TO_BOOK) with the operator's price attached → continues at step 9.

## 4. Rancho Pro journey (screen-by-screen)

Mobile-first, dark high-contrast theme, huge tap targets, minimal typing.

1. **Today** (`/pro`) — ordered cards: `17:00–17:30 · רמות ב"ש · נועם (או כינוי האופניים) · BMX 20" · פנצ'ר אחורי · צפי: פנימית · 80₪ · 30 דק' · 📷3`. Actions: ניווט (Waze/Google deep link), חיוג/WhatsApp, "יצאתי" (→EN_ROUTE), "התחל עבודה". At-risk indicators: when actual timestamps project the running job past a later window, affected cards flag "צפי איחור" with one-tap actions — notify (prefilled WhatsApp message) or move (calendar). Same-day slot generation consumes projected, not planned, end times.
2. **Requests inbox** (`/pro/requests`) — NEW/NEEDS_REVIEW queue with photos inline. Actions: set expected service+price+duration (catalogue chips) → "מוכן לתיאום" (customer gets the booking link); ask-for-info (template → copy-to-WhatsApp); out-of-scope / workshop-required (reason picker).
3. **Job runner** (`/pro/jobs/[id]`) — one vertical guided flow; header always shows rider/bike, reported problem, agreed total so far. Stages mirror the 10-step on-site protocol:
   - **הגעתי** — →ARRIVED, timestamp.
   - **פתיחה** — two lightweight toggles (protocol steps 2–3): סיבוב ראשוני (בוצע / לא רלוונטי + note — diagnostic input) and ניקוי אבק.
   - **בדיקה** — the 5 safety checks as large toggle rows (תקין / מומלץ לטפל / לא בטוח / אין הילוכים — the last writes `has_gears=false`), free findings with camera; UNSAFE auto-creates a finding.
   - **ממצאים ואישור** — per finding: proposed fix + price (catalogue chips, free price allowed) → "בקש אישור": in-person (parent taps אישור on the technician's phone, name recorded) or send-link (status-page approval). Declined → recorded, "נשאר פתוח" on the bike. All-declined → visit-fee path ("סיום ביקור — דמי ביקור" action). Customer-supplied part deemed unsafe → סירוב מנומק (REFUSED_UNSAFE_PART finding, warranty note in summary).
   - **עבודה** — →IN_SERVICE; actual line items (expected pre-filled), part-source toggle where relevant; mid-work finding loops through אישור.
   - **בדיקת סיום** — →FINAL_SAFETY_CHECK; FINAL-phase check + test-ride toggle + after-photo.
   - **תשלום** — auto-summed total; downward edit with reason allowed; upward beyond approved total blocked without approval (guard surfaces "צריך אישור לקוח"). Method chips: מזומן / ביט / העברה / אחר / ויתור.
   - **סיום** — auto-drafted customer summary (work, safety result, warranty scope when customer part installed, tip — editable), "שלח ללקוח" (status page + copy-to-WhatsApp), "עזבתי" departure tap (`left_site_at` → learning data).
   - Always available: ביטול/סיום חריג — cancel (pre-arrival) or UNRESOLVED with reason (no-show, part unavailable, safety stop…), audit + block release.
4. **Calendar** (`/pro/calendar`) — day/week; blocks (range/day/zone-day); manual booking (minimal form → DRAFT job); drag-move/extend with conflict warnings + customer-notify prompt; cancel with reason; override-with-reason for engine-ineligible placements ("אני יודע מה אני עושה").
5. **Search & household** (`/pro/search`, `/pro/customers/[id]`) — phone/name lookup → household: contacts, riders, bikes, locations, job history. Thin but present in P0 — the returning-customer loop requires it.
6. **Bike card** (`/pro/bikes/[id]`) — identity, photos, unresolved recommendations (red), full visit history (date, work, findings, safety result, before/after).
7. **Settings** — services, zones, availability (incl. technician start location). All editable without deploys.

## 5. Error / empty / edge screens

Every exit is an honest screen with a next action — never a silent failure, never a dead end.

| Case | Screen behavior |
|---|---|
| **Out-of-scope** (אופניים חשמליים, אופני כביש at step 3; e-bike/suspension/wheel-building/road detected at intake) | Respectful screen: "כרגע אנחנו לא מטפלים ב… — מבטיחים לעדכן כשזה ישתנה" + phone capture → Lead (reason OUT_OF_SCOPE). Never silently booked. |
| **Workshop-class request** (cranks, bleeding…) | P0 terminal WORKSHOP_REQUIRED with honest copy; operator follows up manually (TBD T5: exact handling of workshop-class requests today). |
| **Out-of-zone** (step 6 address outside active zones) | Honest screen + phone capture → Lead (reason OUT_OF_ZONE). No appointment offered. |
| **Stale slot** (chosen slot taken or invalidated between offer and confirm — race loser, zone-day disabled, block added, service deactivated) | "הזמן הזה בדיוק נתפס — הנה החלופות הקרובות" with freshly ranked alternatives, replacing silent failure. |
| **No slots** (nothing eligible in 7 days → widen to 14 → still nothing) | Honest screen; request drops to NEEDS_REVIEW (reason NO_SLOT) for manual resolution → Lead-style follow-up by operator. Engine failure → same graceful path (reason ENGINE_FAILURE). |
| **Ambiguous intake** (LOW confidence) | Never an error — the Service Request branch copy at step 8 (concierge framing). |
| **Missing/skipped photos** | Not an error state; confidence lowered, flow continues. |
| **Hardening scope (M12)** | Error/empty/loading states, network-failure retries across both surfaces. |
