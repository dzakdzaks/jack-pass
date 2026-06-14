import { expect, test } from "@playwright/test";

test("loads the JackPass app shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("JackPass");
  await expect(page.getByRole("heading", { name: "JackPass" })).toBeVisible();
  await expect(page.getByText(/encrypted password manager/i)).toBeVisible();
});
