# Rancho RideCare — Product Requirements

> Status: Phase 0 plan approved 2026-08-18 **with defaults** (O1 tire-pricing semantics parked as QUOTE; all TBD values configurable and marked TBD). Milestone M0 (foundation) in progress. Journey details live in `docs/UX.md`; entities in `docs/DATA_MODEL.md`; slot logic in `docs/SCHEDULING.md`.

## 1. What Rancho RideCare Is

Rancho is a one-technician (Ran) mobile bicycle-repair service in the Be'er Sheva area, built for families: the parent books and pays, the child rides. The brand's compass word is **אחריות** — Rancho only takes work it can stand behind, checks safety on every bike even when only a puncture was ordered, and never surprises a customer with a price after the work.

Rancho RideCare digitizes the existing WhatsApp flow — not as a booking calendar, but as a **lightweight field-service OS** whose primary object is the **Service Job**. The customer experience is Hebrew-first, RTL-first, guest-first, and symptom-first ("מה קרה לאופניים?" — not "choose a service").

Scope of the trade: tubes and tires on kids' bikes (bread and butter), plus mechanical brakes, basic gears, chains, pedals, cables, and tune-ups. E-bikes, suspension service, wheel building, and road bikes are explicitly out of scope today. Service runs Sunday–Thursday, mainly afternoons, across Be'er Sheva, Ofakim, Hatzerim, Omer, Meitar, and Karmit, with a travel surcharge outside Be'er Sheva.

**Not**: generic scheduling SaaS, a diagnosis AI, or a poster that sacrifices readability for street style.

## 2. Users

| User | Role | Emotional target |
|---|---|---|
| **Parent** (customer) | Orders, approves work, pays. Guest-first: no password ever; contact = name + mobile. | "זהו, מצאתי פתרון" |
| **Rider** (usually the child) | The real customer; rides the bike. Optional first-name capture only ("מי רוכב עליהם?"), age_range child/teen/adult, no DOB — data minimization is schema-enforced. | "בא לי לרכב" |
| **Technician** (Ran) | Sole operator in P0 (model is multi-tech-ready, no routing). Works from the Rancho Pro surface: mobile-first, outdoor-usable, minimal typing. | — |

## 3. North Star: First Visit Resolution

Know the bike, the problem, the likely fix, the parts, the price confidence, and the route implications **before the technician starts driving** — that is Pre-Arrival Readiness, and it is what the whole intake/assessment/scheduling pipeline exists to produce.

- Every job records `resolution { first_visit_resolved: bool, exclusion_reason?, unresolved_reason? }`.
- A decline-after-diagnosis visit still ends COMPLETED (resolved commercially) with `exclusion_reason = CUSTOMER_DECLINED` — it is a first-class outcome, not a failure.
- Metric integrity depends on honest exclusion reasons: enum-constrained, operator-reviewed.

## 4. Business Rules (extracted, source-traced)

**Safety**
1. Every completed job includes the mandatory 5-point check: crank; stem & handlebar; wheels & axles; brakes; gears when present. "Checked OK" is distinct from "not applicable"; GEARS is the only item that may be N/A, and only for gearless bikes.
2. Red-flag findings (loose steering, bad axles, worn-out tires, frame crack, braking problems) are first-class data: surfaced prominently, explained, recorded as repaired-or-not, and persisted on the bicycle if unresolved.
3. Safety explanation precedes everything; software never certifies a bike as safe — the technician does.
4. Customer-supplied parts: Rancho warrants installation only, and refuses to install unsafe/unsuitable parts → line items carry a part-source flag; a refusal path exists and is recorded.

**Pricing & approval**
5. "שינוי מחיר בשטח מחייב הסכמה לפני עבודה" — any material price change discovered on site requires recorded customer approval *before* the additional work. The approval is auditable (proposed work, explanation, price, decision, approver, timestamp, technician). The final charged amount can never exceed the approved total without an approval record.
6. Initial price given at intake (spec aspiration: "already in WhatsApp") — mirrored with price confidence levels HIGH (exact), MEDIUM (range), LOW (customer copy: צריך לראות לפני שמתמחרים).
7. Visit/diagnosis fee: intent of ~50–60₪ in Be'er Sheva when no work is performed or the customer declines after diagnosis. Configurable, placeholder 60₪, exact value **TBD** (T1); per approved defaults, credited against a same-visit repair. The decline-after-diagnosis visit is a first-class job outcome.
8. Minimum regular call from 80₪; typical transaction 80–200₪. Minimum-order is a per-zone configurable.
9. Travel surcharge outside Be'er Sheva by distance/fuel/time → per-zone configurable travel charge; P0 uses flat per-zone amounts (**TBD** values, T2), formula later.
10. No price wars, fair from the start — no discount-code machinery in P0.

**Service catalogue & scope**
11. A service enters the catalogue only when Ran can perform it at warranty level → admin-curated catalogue items with active/inactive.
12. Out-of-capability intake (e-bike, suspension, wheel building, road bikes; workshop-class jobs like cranks/bleeding) must be detected at intake and routed to a respectful out-of-scope path — never silently booked.
13. Tune-up scopes per the price list: טיפול בקטנה (100₪) = general check, brake adj., gear adj., bolt tightening, air pressure, explicitly *without* chain clean & lube; טיפול על מלא (200₪) adds chain clean & lube.

**Operations & scheduling**
14. Work days Sun–Thu, mainly afternoons → zone operating windows configurable; defaults reflect afternoons.
15. ~30–40 min per call, target 12–15 calls/day → per-service estimated duration + configurable operational block; the daily target is aspirational ("quality precedes chasing call counts").
16. Availability aspiration: within 24h when feasible → slot generation includes same-day/next-day and surfaces earliest options first.
17. Service zones: Be'er Sheva, Ofakim, Hatzerim, Omer, Meitar, Karmit — configurable entities, not hard-coded.

**Documentation & history**
18. Every bike has a card: manufacturer, model, serial; every treatment records date, type, work done, before photo, after photo, findings, unfixed defects, safety-check result. "Next visit continues from history" → returning flows skip re-collection.
19. The 10-step on-site protocol is the backbone of the Rancho Pro job flow: arrival → initial ride if possible → dust cleaning → full safety check → findings → explanation & solution → approval → execution → finish check + test ride → documentation, tip, payment. All ten steps have a capture point in the job runner (the ride/cleaning steps as lightweight toggles).

**Warranty & complaints**
20. Complaint flow: inspect first, then classify warranty vs new damage; Rancho errors fixed immediately → jobs carry a `follow_up_required` flag and an `originating_job_id` link for warranty/follow-up visits (full complaint module later). Warranty terms/duration are **TBD** (T6) — free-text policy line.

**Voice**
21. Copy: short, eye-level, confident, friendly; bad news stated plainly (problem, implication, solution, price) without drama. Street slang is seasoning, not the base.

## 5. Instant-Book vs Service Request

Two distinct booking paths; the split is decided by the deterministic assessment at intake:

- **Instant-book**: confidence HIGH or MEDIUM **and** the expected service is `instant_book_eligible` **and** the zone is active → the customer picks a slot immediately (request auto-advances to READY_TO_BOOK).
- **Service Request**: LOW confidence, the אחר bike category, or suspension-adjacent answers → concierge path, framed as care not rejection: "רוצים שנציץ בזה לפני שנתאם? אנחנו עוברים על התמונות וחוזרים אליכם עם מחיר וזמן — בדרך כלל תוך כמה שעות." Operator reviews, prices, and sends a booking link; the customer then continues through the normal slots flow.

Ambiguity never auto-schedules: LOW confidence always lands in NEEDS_REVIEW. Out-of-scope (e-bike, suspension, wheel building, road bike) and workshop-class work (P0 terminal WORKSHOP_REQUIRED, handled manually) exit respectfully; out-of-zone and no-slot cases capture a **Lead** — never a dead end, never a silent booking.

## 6. Price-Confidence Model

Catalogue items carry `price_type FIXED | RANGE | QUOTE`; assessments carry `confidence HIGH | MEDIUM | LOW` with price_low/high and rationale.

| Confidence | Meaning | Customer experience |
|---|---|---|
| HIGH | Exact price known (FIXED item, constraints satisfied) | Exact price at assessment, e.g. "החלפת פנימית — 80₪" |
| MEDIUM | Bounded range | "80–110₪, נדע בדיוק אחרי שנראה" |
| LOW | Must see the bike first | Service Request path (צריך לראות לפני שמתמחרים) |

Standing confidence policies from approved defaults:
- Tire replacement (החלפת צמיג): **QUOTE** until O1 (120₪ all-inclusive vs 120₪ labor + 45₪ tire) is answered.
- Tube/tire work on wheel sizes outside 20"–26": MEDIUM, range 80–110₪, pending small-wheel pricing (**TBD**, T3/O2).
- Non-Be'er-Sheva zones until surcharge amounts are set (**TBD**, T2): MEDIUM with "כולל הגעה — נאשר סופית בתיאום".
- Cable/pedal prices seeded with "includes standard part" assumption, flagged (**TBD**, T4/O3).
- Skipping photos at intake lowers confidence, never blocks booking.

## 7. Customer Journey (overview — details in UX.md)

Guest flow, one question per screen, back always works, draft survives refresh:

1. Landing — brand moment, CTA "מה קרה לאופניים?"
2. Problem — symptom cards (puncture, brakes, gears, chain, loose/noisy, tune-up, "אני לא יודע מה הבעיה")
3. Bicycle — category, wheel size, optional brand/rider; early exits for e-bike/road bike (out-of-scope → Lead)
4. Guided intake — 2–4 symptom-specific chip questions, every path has "לא יודע"
5. Photos — overall + close-up; skippable, skipping lowers confidence
6. Location — Hebrew address autocomplete, zone resolved silently; out-of-zone → Lead
7. Contact — name + mobile (bootstraps the Household); no password, no email required
8. Assessment — price + confidence shown; LOW branches to Service Request
9. Slots — 3–5 ranked windows, earliest first
10. Review — one card, incl. "אם נגלה משהו נוסף — נסביר, נתמחר, ולא נעבוד בלי אישור שלכם."
11. Confirmation — status link; stale-slot case gets honest alternatives ("הזמן הזה בדיוק נתפס")
12. Status page (`/s/token`) — customer-language timeline, approval prompts, change/cancel contact affordance; post-completion it becomes the summary (work, safety check, approvals, before/after, total, maintenance tip) with re-booking CTA "קבעו תיקון נוסף"

Service-request path replaces 9–11 with: "קיבלנו! אנחנו בודקים את זה בשבילכם" → operator review → booking link with the operator's price → continues at step 9.

## 8. Rancho Pro Journey (overview — details in UX.md)

Mobile-first, dark high-contrast, huge tap targets:

1. **Today** (`/pro`) — ordered job cards, navigation/call deep links, "יצאתי" / "התחל עבודה", at-risk lateness flags ("צפי איחור") with one-tap notify or move
2. **Requests inbox** — review, clarify (copy-to-WhatsApp templates), price → "מוכן לתיאום", out-of-scope/workshop actions
3. **Job runner** — the 10-step protocol as a guided flow: הגעתי → פתיחה → בדיקה (5-point check) → ממצאים ואישור (in-person or link approval) → עבודה → בדיקת סיום → תשלום (amount guards) → סיום (summary, departure tap); cancel/UNRESOLVED always available
4. **Calendar** — day/week, blocks (time/day/zone-day), manual booking, move/extend/cancel, override-with-reason
5. **Search & household** — phone/name lookup → contacts, riders, bikes, locations, history
6. **Bike card** — identity, photos, unresolved recommendations, full visit history
7. **Settings** — services, zones, availability; everything operational editable without deploys

## 9. Scope Boundaries

**P0 — the complete loop, nothing else**: guest booking (problem→bike→intake→photos→location→contact→assessment→slots-or-request→confirm→status); deterministic assessment with 3 confidence levels; instant-book vs service-request split; scheduling engine (eligibility, ranking, windows, commit-time recheck, fallback); customer status page with full state mapping, change/cancel affordance, approval screen, completion summary + token-based re-booking; Rancho Pro (Today with at-risk flags, requests inbox, 10-step job runner incl. visit-fee and unresolved outcomes, approvals, payment recording with amount guards, completion, calendar with blocks/moves/cancels/overrides, household search, bike cards, settings); household/bike/history model; photos; Lead capture; staff auth (single gate); Hebrew RTL throughout; E2E scenarios A–F green.

**Recorded P0 exclusions**:
- Rider-culture content limited to the maintenance-tip line — the kid-facing "שלוש בדיקות לפני רכיבה" card ships in P1; the pillar is otherwise expressed off-product.
- Automated overrun re-optimization deferred — manual notify/move only in P0.
- Inventory table deferred — actual parts recorded as line-item chips.
- Also not built in P0 (documented extension points): notification outbox/cron (status page + dev console + copy-to-WhatsApp are the real P0 channels), payment processing (states recorded only: cash/Bit/transfer/other/waived), multi-technician routing, discount codes, customer accounts (guest + tokens; OTP in P1).

**P1**: customer OTP/magic-link + My Bikes; WhatsApp Business API + SMS (activates the outbox); routing/ETA provider; payment provider (business decision); inventory + Daily Loadout; waitlist + cancellation-slot recovery; video intake; while-you-are-here; self-service rescheduling; reminder automation; kid-facing 3-check card in the completion summary.

**P2**: AI-assisted intake classification/summarization (assistive only — never a safety authority); predictive maintenance; multi-technician dispatch + skills + role-based authorization; demand forecasting; purchasing; loyalty/community/events; shop/custom ecosystem.
