import { expect, test } from "@playwright/test";

test("loads the home page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Gardenerd" })).toBeVisible();
  await expect(page.getByRole("link", { name: /containers/i })).toBeVisible();
});
