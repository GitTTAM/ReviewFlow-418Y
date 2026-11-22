import { test, expect } from "@playwright/test";

async function signIn(page, email) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ReviewFlow!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pick up where you left off." })).toBeVisible();
  await page.goto("/manager/reviews");
}

test("US-04 / UI-03: manager sees own reviews, statuses and working review links", async ({ page }) => {
  await signIn(page, "matt.manager@example.test");
  await expect(page.getByRole("heading", { name: "My assigned reviews." })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Jordan Demo", exact: true })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "Jordan Demo" });
  const status = await row.locator("td").nth(2).innerText();
  expect(["Assigned", "In progress", "Completed"]).toContain(status);
  const link = row.getByRole("link", { name: /review for Jordan Demo/ });
  const expected = status === "Completed" ? /\/reviews\/[a-f0-9]{24}$/ : /\/reviews\/[a-f0-9]{24}\/edit$/;
  await expect(link).toHaveAttribute("href", expected);
  await link.click();
  await expect(page).toHaveURL(expected);
});

test("US-04 / UI-03: empty manager sees an empty-state message", async ({ page }) => {
  await signIn(page, "empty.manager@example.test");
  await expect(page.getByRole("heading", { name: "No assigned reviews." })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(0);
});

test("US-04 / UI-07: load failure hides reviews and Try again recovers", async ({ page }) => {
  await signIn(page, "matt.manager@example.test");
  await expect(page.getByRole("cell", { name: "Jordan Demo", exact: true })).toBeVisible();
  await page.route("**/api/manager/reviews", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Reviews could not be loaded. Please try again." }),
    }), { times: 1 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Reviews could not be loaded." })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Jordan Demo", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("cell", { name: "Jordan Demo", exact: true })).toBeVisible();
});

test("US-04 / UI-08: dashboard access denied on 403 and another manager's link is blocked", async ({ page, browser }) => {
  await signIn(page, "matt.manager@example.test");
  const foreignReview = await page.getByRole("row").filter({ hasText: "Jordan Demo" }).getByRole("link").getAttribute("href");
  const rileyContext = await browser.newContext();
  try {
    const rileyPage = await rileyContext.newPage();
    await signIn(rileyPage, "riley.manager@example.test");
    await expect(rileyPage.getByRole("cell", { name: "Jordan Demo", exact: true })).toHaveCount(0);
    await rileyPage.goto(foreignReview);
    await expect(rileyPage.getByRole("heading", { name: "This review is unavailable." })).toBeVisible();
  } finally {
    await rileyContext.close();
  }
  await page.route("**/api/manager/reviews", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ message: "This page is not available for your role." }),
    }), { times: 1 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "This review is unavailable." })).toBeVisible();
});
