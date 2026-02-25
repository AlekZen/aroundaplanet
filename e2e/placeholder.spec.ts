import { test, expect } from "@playwright/test";

test("placeholder page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AroundaPlanet/);
});
