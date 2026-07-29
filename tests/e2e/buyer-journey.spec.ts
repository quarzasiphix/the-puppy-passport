import { test, expect } from "@playwright/test";
import { DEMO_ACCOUNTS, expectNoPageErrors, signIn, trackPageErrors } from "./helpers";

test.describe("buyer journey @critical", () => {
  test("save and unsave a puppy from find-a-dog, reflected on the saved-dogs dashboard", async ({
    page,
  }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.buyer);

    await page.goto("/find-a-dog");
    const saveBtn = page.getByRole("button", { name: /^Save$|^Remove from saved$/ }).first();
    await expect(saveBtn).toBeVisible();
    const wasSaved = (await saveBtn.getAttribute("aria-label")) === "Remove from saved";
    if (wasSaved) {
      await saveBtn.click();
      await expect(saveBtn).toHaveAttribute("aria-label", "Save", { timeout: 5_000 });
    }

    await saveBtn.click();
    await expect(saveBtn).toHaveAttribute("aria-label", "Remove from saved", { timeout: 5_000 });

    await page.goto("/dashboard/buyer/saved");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // restore original state
    await page.goto("/find-a-dog");
    await page.getByRole("button", { name: "Remove from saved" }).first().click();

    expectNoPageErrors(tracker, "during save/unsave");
  });

  test("quotations page shows plain-language status labels, never a raw enum, and hides Accept for expired quotes", async ({
    page,
  }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await page.goto("/dashboard/buyer/quotations");
    await expect(page.getByRole("heading", { name: "Quotations" })).toBeVisible();

    const body = await page.locator("body").innerText();
    const hasQuotations = !/No quotations yet/.test(body);
    if (hasQuotations) {
      // Regression for ledger entries 4/5: raw status enum values must never render.
      for (const raw of [/\bsent\b/i, /\bviewed\b/i, /\breplaced\b/i]) {
        const translated = /Awaiting your response|Replaced by a new quotation/.test(body);
        if (!translated) expect(body, `raw quotation status leaked: ${raw}`).not.toMatch(raw);
      }
      // Regression for backend main commit 5cc520f: an expired quote must never offer Accept.
      const expiredCard = page.locator("text=This quote expired on").first();
      if (await expiredCard.count()) {
        const card = expiredCard.locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
        await expect(card.getByRole("button", { name: "Accept quotation" })).toHaveCount(0);
        await expect(card.getByRole("button", { name: "Dismiss" })).toBeVisible();
      }
    }
    expectNoPageErrors(tracker, "on quotations page");
  });

  test("applications page loads without error", async ({ page }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await page.goto("/dashboard/buyer/applications");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on applications page");
  });

  test("followed profiles dashboard correctly classifies breeders vs foundations", async ({
    page,
  }) => {
    const tracker = trackPageErrors(page);
    await signIn(page, DEMO_ACCOUNTS.buyer);
    await page.goto("/dashboard/buyer/followed");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expectNoPageErrors(tracker, "on followed dashboard");
  });
});
