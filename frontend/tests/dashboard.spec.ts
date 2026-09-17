import { expect, test } from "@playwright/test";

const TEST_EMAIL = `playwright-dashboard-${Date.now()}@example.com`;
const TEST_PASSWORD = "playwright-test-password";

let token: string;

test.beforeAll(async ({ request, baseURL }) => {
  let res = await request.post(`${baseURL}/api/auth/signup`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  if (res.status() === 409) {
    // A parallel worker already created this account (Date.now() collision)
    // — log in instead to get a token for the same account.
    res = await request.post(`${baseURL}/api/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
  }
  expect(res.ok()).toBeTruthy();
  token = (await res.json()).token;
});

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(TEST_EMAIL);
  await page.getByPlaceholder("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("day view shows a freshly saved item", async ({ page, request, baseURL }) => {
  const uniqueTitle = `Playwright day-view item ${Date.now()}`;
  const res = await request.post(`${baseURL}/api/v1/save`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      captureType: "selection",
      url: "https://example.com/day-view",
      title: uniqueTitle,
      content: "Seeded by the Playwright day-view test.",
    },
  });
  expect(res.ok()).toBeTruthy();

  await login(page);
  await expect(page.getByText(uniqueTitle)).toBeVisible();
});

test("search finds an item saved on a previous day", async ({ page, request, baseURL }) => {
  const uniqueKeyword = `playwright-search-${Date.now()}`;
  const res = await request.post(`${baseURL}/api/v1/save`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      captureType: "full_page",
      url: "https://example.com/search-target",
      title: "Search target",
      content: `Content containing the keyword ${uniqueKeyword} for search testing.`,
    },
  });
  expect(res.ok()).toBeTruthy();

  await login(page);
  await page.getByPlaceholder("Search all saved items…").fill(uniqueKeyword);
  await expect(page.getByText(uniqueKeyword, { exact: false })).toBeVisible();
});

test("deleting an item removes it from the day view", async ({ page, request, baseURL }) => {
  const uniqueTitle = `Playwright delete-me ${Date.now()}`;
  const res = await request.post(`${baseURL}/api/v1/save`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      captureType: "selection",
      url: "https://example.com/delete-target",
      title: uniqueTitle,
      content: "This item should disappear after clicking Delete.",
    },
  });
  expect(res.ok()).toBeTruthy();

  await login(page);
  const card = page.locator("article", { hasText: uniqueTitle });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Delete" }).click();
  await expect(card).toHaveCount(0);
});
