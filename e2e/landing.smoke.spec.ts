import { test, expect } from "@playwright/test";

test.describe("landing (mobile, RTL)", () => {
  test("renders Hebrew RTL landing with the problem-first CTA", async ({
    page,
  }) => {
    await page.goto("/");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(html).toHaveAttribute("lang", "he");

    await expect(page).toHaveTitle(/רנצ'ו/);

    const cta = page.getByRole("link", { name: "מה קרה לאופניים?" });
    await expect(cta).toBeVisible();

    // CTA leads into the booking flow
    await cta.click();
    await expect(page).toHaveURL(/\/book$/);
  });

  test("has no horizontal scroll on a mobile viewport", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
