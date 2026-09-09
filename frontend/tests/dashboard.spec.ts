import { expect, test } from "@playwright/test";

const PASSWORD = process.env.DASHBOARD_PASSWORD ?? "test-value-1234567890123456";
const TOKEN = process.env.BACKEND_AUTH_TOKEN ?? "test-value-1234567890123456";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("day view shows a freshly saved item", async ({ page, request, baseURL }) => {
  const uniqueTitle = `Playwright day-view item ${Date.now()}`;
  const res = await request.post(`${baseURL}/api/v1/save`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
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
    headers: { Authorization: `Bearer ${TOKEN}` },
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
    headers: { Authorization: `Bearer ${TOKEN}` },
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
