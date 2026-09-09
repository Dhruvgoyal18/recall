import { expect, test } from "@playwright/test";

const PASSWORD = process.env.DASHBOARD_PASSWORD ?? "test-value-1234567890123456";

test("unauthenticated visit to the dashboard redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Recall" })).toBeVisible();
});

test("wrong password stays on login with an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Incorrect password.")).toBeVisible();
});

test("correct password unlocks the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Recall" })).toBeVisible();
});
