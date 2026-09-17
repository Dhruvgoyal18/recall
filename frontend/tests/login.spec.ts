import { expect, test } from "@playwright/test";

const TEST_EMAIL = `playwright-login-${Date.now()}@example.com`;
const TEST_PASSWORD = "playwright-test-password";

test.beforeAll(async ({ request, baseURL }) => {
  const res = await request.post(`${baseURL}/api/auth/signup`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  // 409 means a parallel worker already created this account (Date.now()
  // collision) — that's fine, the account exists either way.
  expect(res.ok() || res.status() === 409).toBeTruthy();
});

test("unauthenticated visit to the dashboard redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Recall" })).toBeVisible();
});

test("wrong password stays on login with an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(TEST_EMAIL);
  await page.getByPlaceholder("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("invalid email or password")).toBeVisible();
});

test("correct password unlocks the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.getByPlaceholder("Email").fill(TEST_EMAIL);
  await page.getByPlaceholder("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Recall" })).toBeVisible();
});
