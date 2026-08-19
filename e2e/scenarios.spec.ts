import { test, expect, type Page } from "@playwright/test";

/**
 * E2E scenarios A–E (docs/ROADMAP.md appendix) against a production build
 * with a fresh PGlite database. Scenario F (calendar-free but travel-infeasible
 * slot is INELIGIBLE) is covered exhaustively by the engine fixture suite in
 * src/domain/scheduling/engine.test.ts — the UI never receives such slots.
 *
 * Serial: later scenarios reuse state (Scenario E returns to A's household).
 */

test.describe.configure({ mode: "serial" });

let jobToken = "";
let requestBToken = "";

async function fillBookingIntake(
  page: Page,
  opts: {
    symptom: string;
    intakeAnswers?: string[];
    address: string;
    name?: string;
    phone?: string;
  },
) {
  await page.goto("/book");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/book");
  await page.getByRole("button", { name: opts.symptom }).click();

  await page.getByRole("button", { name: "אופני ילדים" }).click();
  await page.getByRole("button", { name: '20"', exact: true }).click();
  await page.getByRole("button", { name: "המשך" }).click();

  for (const answer of opts.intakeAnswers ?? []) {
    await page.getByRole("button", { name: answer, exact: true }).click();
  }
  await page.getByRole("button", { name: "המשך" }).click();

  // photos — explicitly skippable, never blocks
  await page.getByRole("button", { name: /אפשר גם בלי/ }).click();

  await page.getByLabel("כתובת מלאה").fill(opts.address);
  await page.getByRole("button", { name: "המשך" }).click();
}

async function fillContact(page: Page, name: string, phone: string) {
  await page.getByLabel("שם").fill(name);
  await page.getByLabel("טלפון נייד").fill(phone);
  await page.getByRole("button", { name: "המשך" }).click();
}

async function proLogin(page: Page) {
  await page.goto("/pro/login");
  await page.getByLabel("אימייל").fill("ran@rancho.local");
  await page.getByLabel("סיסמה").fill("rancho-dev");
  await page.getByRole("button", { name: "כניסה" }).click();
  await expect(page.getByRole("heading", { name: /היום/ })).toBeVisible();
}

test("Scenario A+C: puncture booked end-to-end; additional work approved before execution", async ({
  page,
}) => {
  test.setTimeout(180_000);

  // — customer books —
  await fillBookingIntake(page, {
    symptom: "יש פנצ'ר / הגלגל ריק",
    intakeAnswers: ["אחורי", "מיד", "לא"],
    address: "רחוב הרצל 5, באר שבע",
  });
  await fillContact(page, "דנה לוי", "0521111111");

  await expect(page.getByText("הנה מה שנראה לנו")).toBeVisible();
  await expect(page.getByText("החלפת פנימית רגילה")).toBeVisible();
  await page.getByRole("link", { name: /בחרו זמן/ }).click();

  await expect(page.getByRole("heading", { name: "מתי נוח לכם שנגיע?" })).toBeVisible();
  await page.locator("button[dir=ltr]").first().click();

  await page.waitForURL(/\/s\/[a-f0-9]+/);
  jobToken = page.url().match(/\/s\/([a-f0-9]+)/)![1];
  await expect(page.getByRole("heading", { name: "נקבע" })).toBeVisible();

  // — technician runs the visit —
  await proLogin(page);
  await page.getByRole("button", { name: "יצאתי" }).click();
  await page.getByRole("link", { name: /פתח עבודה|המשך עבודה/ }).click();
  await page.getByRole("button", { name: "הגעתי" }).click();
  await page.getByRole("button", { name: "מתחיל בדיקה" }).click();

  // mandatory 5-point check; gearless kids bike → GEARS marked N/A
  await expect(page.getByText("בדיקת בטיחות — חובה בכל ביקור")).toBeVisible();
  for (const btn of await page.getByRole("button", { name: "תקין", exact: true }).all()) {
    await btn.click();
  }
  await page.getByRole("button", { name: "אין הילוכים" }).click();
  await page.getByRole("button", { name: "שמור בדיקה" }).click();

  // Scenario C — a finding priced and approved IN PERSON before execution
  await page.getByRole("button", { name: "+ ממצא חדש" }).click();
  await page.getByPlaceholder(/מה מצאת/).fill("כבל בלם שחוק");
  await page.getByRole("button", { name: "הוסף ממצא" }).click();
  await expect(page.getByText("כבל בלם שחוק")).toBeVisible();

  await page.getByPlaceholder("הצעת תיקון").fill("החלפת כבל מעצור");
  await page.getByPlaceholder("מחיר ₪").fill("80");
  await page.getByPlaceholder(/שם המאשר/).fill("דנה");
  await page.getByRole("button", { name: "אושר במקום" }).click();
  await page.getByRole("button", { name: "תוקן" }).click();

  await page.getByRole("button", { name: /מתחיל לעבוד/ }).click();

  await page.getByRole("button", { name: "שמור רשימת עבודה" }).click();
  await page.getByRole("button", { name: "לבדיקת סיום" }).click();

  for (const btn of await page.getByRole("button", { name: "תקין", exact: true }).all()) {
    await btn.click();
  }
  await page.getByRole("button", { name: "אין הילוכים" }).click();
  await page.getByRole("button", { name: "שמור בדיקה" }).click();
  await page.getByRole("button", { name: "לתשלום" }).click();

  // approved ceiling: 80 booked + 80 approved = 160
  await expect(page.getByText("סה\"כ מאושר: 160 ₪")).toBeVisible();
  await page.getByPlaceholder(/אין תמונת אחרי/).fill("בדיקת מערכת");
  await page.getByRole("button", { name: "דלג עם סיבה" }).click();
  await page.getByRole("button", { name: "ביט" }).click();
  await page.getByRole("button", { name: "סגור עבודה" }).click();
  await expect(page.getByText("הושלם")).toBeVisible();

  // — customer sees the honest summary —
  await page.goto(`/s/${jobToken}`);
  await expect(page.getByRole("heading", { name: /מוכן לרכיבה/ })).toBeVisible();
  await expect(page.getByText("מה עשינו")).toBeVisible();
  await expect(page.getByText("160 ₪").first()).toBeVisible();
  await expect(page.getByText(/עברו בדיקת בטיחות מלאה/)).toBeVisible();
});

test("Scenario B: ambiguous problem never invents a diagnosis — request → operator prices → bookable", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await fillBookingIntake(page, {
    symptom: "משהו רופף או מרעיש",
    intakeAnswers: ["קשה להגיד"],
    address: "שדרות רגר 20, באר שבע",
  });
  await fillContact(page, "אבי מזרחי", "0532222222");

  // concierge copy, not a rejection; no invented price — and a tracking link
  await expect(page.getByText("אנחנו בודקים את זה בשבילכם")).toBeVisible();
  const trackHref = await page
    .getByRole("link", { name: "מעקב אחרי הבקשה" })
    .getAttribute("href");
  requestBToken = trackHref?.match(/\/s\/([a-f0-9]+)/)?.[1] ?? "";
  expect(requestBToken).not.toBe("");

  // operator reviews and prices it
  await proLogin(page);
  await page.goto("/pro/requests");
  await expect(page.getByText("אבי מזרחי").first()).toBeVisible();
  await page.getByPlaceholder(/שירות \(למשל/).first().fill("בדיקה וטיפול בציר");
  await page.getByPlaceholder("מחיר ₪").first().fill("90");
  await page.getByRole("button", { name: "מוכן לתיאום" }).first().click();
  await expect(page.getByText("מוכנה לתיאום").first()).toBeVisible();

  // the customer's status link now offers booking
  await page.goto(`/s/${requestBToken}`);
  await expect(page.getByText("יש לנו הצעה בשבילכם")).toBeVisible();
  await page.getByRole("link", { name: "בחרו זמן" }).click();
  await expect(page.getByRole("heading", { name: "מתי נוח לכם שנגיע?" })).toBeVisible();
});

test("Scenario D: unsupported area gets an honest exit and captures a lead", async ({
  page,
}) => {
  await fillBookingIntake(page, {
    symptom: "יש פנצ'ר / הגלגל ריק",
    intakeAnswers: ["קדמי", "לאט, תוך יום-יומיים", "לא"],
    address: "דיזנגוף 100, תל אביב",
  });
  await expect(page.getByText("עוד לא הגענו לאזור שלכם")).toBeVisible();
  await page.getByLabel("טלפון נייד").fill("0543333333");
  await page.getByRole("button", { name: "עדכנו אותי" }).click();
  await expect(page.getByText(/קיבלנו — נעדכן אתכם/)).toBeVisible();

  // the lead is waiting for the operator
  await proLogin(page);
  await page.goto("/pro/requests");
  await expect(page.getByText("0543333333").first()).toBeVisible();
});

test("Scenario E: returning household — operator lookup and prefilled re-booking", async ({
  page,
}) => {
  // operator side: find by phone, see the household with bike and history
  await proLogin(page);
  await page.goto("/pro/search?q=0521111111");
  await page.getByText("דנה לוי").click();
  await expect(page.getByRole("heading", { name: "דנה לוי" })).toBeVisible();
  await expect(page.getByText("היסטוריית ביקורים")).toBeVisible();
  await expect(page.getByText("מוכן לרכיבה")).toBeVisible();

  // bike card carries the visit history
  await page.getByText("אופני ילדים").first().click();
  await expect(page.getByText("היסטוריית טיפולים")).toBeVisible();

  // customer side: "קבעו תיקון נוסף" prefills bike + location from the token
  await page.goto(`/book?rebook=${jobToken}`);
  await page.getByRole("button", { name: "יש פנצ'ר / הגלגל ריק" }).click();
  await expect(page.getByRole("button", { name: "אופני ילדים" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: '20"', exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("guards: status page hides internals and unknown tokens 404", async ({ page }) => {
  const res = await page.goto("/s/deadbeefdeadbeefdeadbeefdeadbeef");
  expect(res?.status()).toBe(404);

  await page.goto(`/s/${jobToken}`);
  const body = await page.textContent("body");
  for (const internal of ["SCHEDULED", "PAYMENT_PENDING", "INSPECTION", "COMPLETED"]) {
    expect(body).not.toContain(internal);
  }
});
