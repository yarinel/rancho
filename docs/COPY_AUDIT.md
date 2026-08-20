# Copy QA — Phase 1 Audit (Rancho RideCare)

Status: **audit only — no code changed.** Awaiting approval before Phase 2.
Verified: an adversarial 2-agent pass checked every behavior/data claim against the code (all confirmed) and the classification tables (3 corrections applied). Sources used: docs/COPY.md (current-copy map, verified fresh), the V3 excerpts and rules embedded in the Copy QA spec, the brand spec + price list. **The full Master Copy V3 document was not found in the repo or on disk** — where V3 gives no explicit wording, the current copy is left unchanged (per "do not rewrite unapproved copy in your own style"), except where an explicit writing rule dictates a change (each such case is marked `RULE`).

---

## A. Executive Summary

**How copy is organized today:** no i18n layer; strings are hardcoded where they render. Four semi-centralized modules exist and should be edited first: `src/lib/status-map.ts` (all customer statuses), `src/domain/intake.ts` (symptom labels + guided questions), `src/lib/format.ts` (category/symptom labels), `src/db/seed.ts` (customer-facing service names, admin-editable at runtime). Everything else lives in its component or server action (errors).

**Coverage:** 9 major areas, ~351 Hebrew strings across 26 UI files, all mapped in docs/COPY.md (freshness verified programmatically against the code — see G/H).

**Implementation risks:**
1. **E2E tests select by exact Hebrew copy** (`e2e/scenarios.spec.ts`: "הנה מה שנראה לנו", "מתי נוח לכם שנגיע?", "אנחנו בודקים את זה בשבילכם", "סה"כ מאושר: 160 ₪", "לבדיקת סיום", "מוכן לרכיבה" ועוד). Every Phase-2 string change must update the matching test expectation in the same commit — updating expected text, never weakening assertions.
2. **Rule-14 violation in current copy:** the low-confidence screen promises "בדרך כלל תוך כמה שעות" — an SLA the business never committed to. Flagged for removal (B7).
3. **Accuracy gap in the completion safety line:** the static sentence "עברו בדיקת בטיחות מלאה: קראנק, כידון, גלגלים, בלמים והילוכים" claims gears were checked even on gearless bikes (where GEARS is legitimately N/A). Per-item results exist in the DB — fix classified COPY_UI (C2).
4. **No booking-review screen exists:** tapping a slot books immediately. V3's "קבענו." fits the current flow; if V3 intends a review-before-confirm step, that is PRODUCT_REVIEW (E3).

## B. Safe Text-Only Changes (COPY)

| # | Screen / Component | Current | Proposed | Locked? |
|---|---|---|---|---|
| B1 | דף הבית — כותרת + CTA (`src/app/page.tsx`) | פנצ'ר? תיקון? טיפול? שב בכייף, אנחנו בדרך / מה קרה לאופניים? | **יושם (החלטת בעלים, 2026-08-20):** הגיע הזמן להוציא את האופניים מהמחסן / תתקנו לי את האופניים | — |
| B2 | דף הבית — משפט משנה | מתקנים אצלכם בבית, מסבירים לפני שמתקנים, ובודקים בטיחות בכל ביקור. | ספרו לנו מה קרה. נבין מה כנראה צריך, נתאם זמן ונגיע אליכם מוכנים. | — |
| B3 | אשף — "לא יודע מה הבעיה" — כותרת (`wizard.tsx`) | נסתכל על זה יחד | לא צריך לנחש. | — |
| B4 | אשף — תמונות — כותרת | תראו לנו רגע | תראו לנו רגע. (פיסוק בלבד) | — |
| B5 | מסך האבחון — כותרת | הנה מה שנראה לנו | יש לנו כיוון. | — |
| B6 | תוצאת בקשה (ביטחון נמוך) — כותרת (display+h1) | קיבלנו! / אנחנו בודקים את זה בשבילכם | הבקשה אצלנו. (display) / רן עובר על הפרטים והתמונות וחוזר אליכם עם מחיר וזמן. (משנה) | — |
| B7 | תוצאת בקשה — גוף `RULE 14` | רן עובר על הפרטים והתמונות וחוזר אליכם עם מחיר וזמן — בדרך כלל תוך כמה שעות. העדכון יגיע בהודעה לטלפון שהשארתם. | העדכון יגיע לטלפון שהשארתם. (המשפט הראשון עובר לכותרת המשנה — B6; בלי כפילות ובלי הבטחת זמן) | 🔒-סמוך (הבטחה תפעולית לא מחויבת — מוסרת) |
| B8 | סטטוס לקוח — נקבע (`status-map.ts`) | נקבע | קבענו. | — |
| B9 | ציר הזמן — תחנה 1 (`status-map.ts`) | נקבע | קבענו | — |
| B10 | סטטוס לקוח — הגיע/בודק | הגענו · בודקים את האופניים | הגענו. מתחילים בבדיקה. | — |
| B11 | סטטוס לקוח — עובד + תחנת ציר | עובדים על זה | מתקנים עכשיו. (תחנה: מתקנים) | — |
| B12 | סטטוס לקוח — ממתין לאישור | מצאנו משהו — מחכה לאישור שלכם | צריך את האישור שלכם. | 🔒 משמעות נשמרת |
| B13 | מסך סיכום הזמנה — שורת השקיפות (`wizard.tsx`) | אם נגלה משהו נוסף — נסביר, נתמחר, ולא נעבוד בלי אישור שלכם. | אם נגלה משהו נוסף — נסביר ונתמחר. לא נבצע עבודה נוספת בלי אישור שלכם. | 🔒 משמעות נשמרת/מתחזקת |
| B14 | שגיאת כתובת (booking.ts + wizard) `RULE` | כתובת לא תקינה / לא הצלחנו לזהות את הכתובת — נסו שוב | לא הצלחנו לזהות את הכתובת. בדקו את הרחוב, המספר והעיר. (מאוחד לשני המקרים) | — |
| B15 | ולידציית טלפון (booking.ts) `RULE` | מספר טלפון ישראלי | הכניסו מספר נייד ישראלי, למשל 05X-XXXXXXX. | — |
| B16 | שגיאת תקשורת (לקוח, כל האשף/סטטוס) `RULE` | בעיית תקשורת — נסו שוב | לא הצלחנו להתחבר. בדקו את החיבור ונסו שוב. | — |
| B17 | fallback כללי `RULE` | משהו השתבש, נסו שוב | לא הצלחנו להשלים את הפעולה. נסו שוב. | — |
| B18 | Pro — כותרת רץ העבודה | סוכם עד כה | אושר עד עכשיו | 🔒 (מייצג תקרת אישור — משמעות זהה) |
| B19 | Pro — שלב עבודה | עבודה בפועל | עבודה שבוצעה | — |
| B20 | Pro — שלב + כפתור | בדיקת סיום / לבדיקת סיום | בדיקה לפני מסירה / לבדיקה לפני מסירה | 🔒 (הבדיקה נשארת חובה; רק שם) |
| B21 | Pro — כפתור עזיבה | עזבתי | סיימתי כאן | — |
| B22 | Pro — תיבת בקשות, שורת נימוק | אבחון: {נימוק} | כיוון ראשוני: {נימוק} | — |
| B23 | Pro — קישור + כותרת העמסה | מה להעמיס? / מה להעמיס · היום ומחר | מה עולה לרכב? / מה עולה לרכב · היום ומחר | — |
| B24 | אשף — כפתור שלב פרטי קשר `RULE 6` (הצעה) | המשך | שליחה | — |

**נבדקו ונשארים ללא שינוי (תואמים V3):** "מה קרה לאופניים?", "תראו לנו רגע" (מהות), "רן בדרך אליכם" (מוצג רק אחרי "יצאתי" בפועל — עומד בכלל 8), "מוכן לרכיבה". כפתורי "המשך" באמצע האשף נשארים — הפעולה הבאה משתנה לפי מסלול ואין תווית ספציפית אמיתית יותר.

## C. Safe UI Copy Changes (COPY_UI)

| # | Screen / Component | Change | Why UI Change Is Needed |
|---|---|---|---|
| C1 | כרטיס אישור עבודה נוספת (`approval-prompt.tsx` + `s/[token]/page.tsx`) | היררכיה: **מה מצאנו** (כותרת הממצא הקיימת) ← **התיקון המוצע** ← **תוספת מחיר** | כותרת הממצא כבר נטענת באותו עמוד (טבלת findings) אך לא מועברת לרכיב — נדרש prop חדש והוספת תווית. אין שדה חדש, אין API חדש. |
| C2 | סיכום ביקור — סגירה רגשית | הוספת שורת מותג "בא לי לרכב." בתחתית הסיכום (RIDE mode) | תוספת בלוק טקסט סטטי למסך קיים. |

## D. Data-Dependent Changes (COPY_DATA)

| # | Screen / Component | Desired Copy | Required Data | Data Exists? |
|---|---|---|---|---|
| D1 | בחירת זמן (`slot-picker.tsx`) | תג "מומלץ" על החלון הראשון המוצג | אות דירוג אמיתי מהמנוע | **כן** — `display[0]` הוא החלון בעל הציון הגבוה ביותר מהדירוג הדטרמיניסטי (score desc). מותר תג אחד בלבד, על הראשון. |
| D2 | סיכום ביקור — שורת הבטיחות (`s/[token]/page.tsx`) 🔒 | להחליף את המשפט הסטטי ברינדור תוצאות הבדיקה בפועל ("נבדקו: קראנק ✓ … הילוכים — לא רלוונטי") | תוצאות פר-פריט מ-`safety_check_items` | **כן** — קיימות לכל עבודה; העמוד טוען כיום רק את שורת הבדיקה, נדרשת קריאה נוספת של שורות קיימות באותו server component. מתקן אי-דיוק באופניים ללא הילוכים; הצגה נאמנה בלבד, בלי לשון הסמכה. |
| D3 | סטטוס "רן בדרך" | צפי הגעה: {ETA} | ETA אמין | **לא** — קיימים רק חלונות הגעה; `travelTimeEstMin` לא מאוכלס בהזמנה. ⟶ הועבר ל-E1. |
| D4 | העמסה יומית | "חסר לפני שיוצאים" | מלאי בפועל מול צריכה צפויה | **לא** — אין נתוני מלאי (נדחה ל-P1 בהחלטה D13). ⟶ הועבר ל-E2. |

## E. Product Review

| # | Proposal | Why It Is Not Copy-Only | Recommendation |
|---|---|---|---|
| E1 | צפי הגעה (ETA) בזמן נסיעה | דורש ספק ניווט/חישוב זמן אמת שאינו קיים (P1 roadmap: routing provider) | לדחות ל-P1; עד אז נשארת שפת חלון ההגעה הקיימת |
| E2 | "חסר לפני שיוצאים" בהעמסה | דורש טבלת מלאי וכמויות — נדחה במפורש ל-P1 (D13) | לדחות ל-P1 inventory |
| E3 | מסך סקירה לפני אישור הזמנה ("קבענו" ככפתור אישור) | היום הקשה על חלון זמן מזמינה מיידית; מסך סקירה = צעד חדש בזרימה | החלטת מוצר: להשאיר one-tap (פחות חיכוך, revalidation קיים) או להוסיף מסך סקירה. הקופי "קבענו." יושם בינתיים כסטטוס (B8) — תואם את הזרימה הקיימת |
| E4 | שדה "למה זה חשוב" מובנה באישור עבודה | קיים כבר שדה הסבר חופשי (`explanationHe`) שמוצג ללקוח; שדה מובנה = סכמה חדשה | להשתמש בשדה הקיים; אין צורך בשינוי |
| E5 | תבניות הודעות (תזכורות, יציאה לדרך וכו') | לא קיימים ערוצי שליחה — רק שתי הודעות וואטסאפ ידניות קיימות (נסקרו ב-B) | קופי הודעות ייכתב כשיחובר ערוץ (P1 WhatsApp/SMS) |

## F. Locked Copy Review

| פריט 🔒 | הצעה | המשמעות נשמרת? |
|---|---|---|
| שורת השקיפות בהזמנה | B13 | ✔ מתחזקת (ניסוח V3 Safety/Money) |
| סטטוס "ממתין לאישור" | B12 | ✔ |
| "האישור נרשם עם שם, שעה ומחיר — ולא נעבוד בלי הסכמה שלכם." (כרטיס האישור) | ללא שינוי | ✔ |
| "צריך לראות לפני שמתמחרים" | ללא שינוי | ✔ |
| "כולל הגעה — נאשר סופית בתיאום" (אזור TBD) | ללא שינוי | ✔ |
| תוצאות בטיחות (תקין/מומלץ לטפל/לא בטוח) ותווית "אין הילוכים" | ללא שינוי (תוויות Pro קצרות) | ✔ |
| שורת הבטיחות בסיכום | D2 — הצגה נאמנה של מה שנבדק בפועל | ✔ מתחזקת (מסיר הגזמה) |
| כל שגיאות ה-guards (בטיחות/תשלום/אישורים) | ללא שינוי — עובדתיות, Safety/Money mode | ✔ |
| "עבודה מעבר למה שסוכם דורשת אישור לקוח — הוסיפו ממצא ובקשו אישור." | ללא שינוי | ✔ |
| הערת הזמנה ידנית (עוקפת שיבוץ, לא דורסת עבודה) | ללא שינוי | ✔ |
| "אושר עד עכשיו" (B18) ו"בדיקה לפני מסירה" (B20) | שינוי תווית בלבד — ה-guards, ה-enum וה-state ללא שינוי | ✔ |
| הסרת "תוך כמה שעות" (B7) | הסרת הבטחה לא-מחויבת | ✔ (כלל 14) |

## G. Unmapped Copy (נמצא בקוד, חסר במפה)

- נגישות: `ניווט ראשי` (aria, ניווט Pro); alt "תמונת אופניים"; aria-labels בטפסי היומן/זמינות (תאריך, משעה, עד שעה, אזור, שעה חדשה…)
- מצבי טעינה: `מעלה…`, `…` (העלאת תמונות)
- Fallbacks: `שגיאה` (ברירת מחדל ב-3 רכיבי Pro), `בתהליך` (status-map default), `עבודה לא נמצאה`, `בקשה לא נמצאה`, `אין תור פעיל`
- Pro: `אורח (טרם השאיר פרטים)` (תיבת בקשות), `מידה לא ידועה` (העמסה), שמות ימים מלאים בהגדרות זמינות
- נימוקי האבחון (15 מחרוזות ב-`assessment.ts`, מוצגות למפעיל כ"אבחון: …"), ו-`תומחר ידנית ע"י {שם}: {שירות}`
- שגיאות guard מלאות מ-`job-machine.ts` (חסרה בדיקה: X, בדיקת X לא נרשמה, מסלול דמי-ביקור…, ועוד — חלקן הופיעו במפה בקיצור)
- תיאורי ה-TBD בקטלוג (3 מחרוזות מ-seed, מוצגות במסך השירותים)

כל אלה יתווספו ל-docs/COPY.md בעת היישום. אף אחד מהם לא מקבל שכתוב V3 (אין הנחיה) — למעט `שגיאה` שיאוחד ל-fallback של B17 בגרסת Pro קצרה.

## H. Missing / Stale Copy Map Entries

לא נמצאו — המפה נוצרה מול המצב הנוכחי של הקוד ואומתה בהשוואה פרוגרמטית. (המפה מקבצת חלק מהשדות בשורות מרוכזות — זה תיעוד מקוצר, לא סטייל.)

## I. Implementation Plan (מומלץ, לאחר אישור)

1. **Phase 2 — COPY בלבד**, בסדר הזה: `status-map.ts` (מרכזי, B8–B12) → `wizard.tsx` + `page.tsx` (B1–B7, B13, B24) → שגיאות (`booking.ts`, `wizard.tsx`, `slot-picker.tsx`, `approval-prompt.tsx`, `while-here.tsx` — B14–B17) → Pro (B18–B23). **באותו קומיט:** עדכון מחרוזות הציפייה ב-`e2e/scenarios.spec.ts` + `landing.smoke.spec.ts`; הרצת typecheck, unit, build, e2e מלאים; בדיקת RTL וגלישת כפתורים במובייל.
2. **Phase 3 — COPY_UI**: C1 (היררכיית אישור) → C2 (סגירה רגשית "בא לי לרכב."), עם צילומי מסך במובייל.
3. **Phase 4 — COPY_DATA**: D1 (תג "מומלץ" על החלון המדורג ראשון) + D2 (שורת בטיחות נאמנה מפריטי הבדיקה) — מקורות הנתונים קיימים ואומתו, ללא שכפול לוגיקה.
4. פריטי E ממתינים להחלטות מוצר/תשתית — לא ייושמו בסבב הזה.
5. ללא שינוי: enums, מסלולים, ערכי API, סכמה, מכונות מצבים, guards.

**עצירה כאן — ממתין לאישור לפני Phase 2.**
