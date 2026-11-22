import { test, expect } from "@playwright/test";
async function signIn(page, email) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ReviewFlow!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
test("US-08/01/02: manager draft, logout/login, corrections, failed save, completion and employee result", async ({
  page,
  browser,
}) => {
  await signIn(page, "matt.manager@example.test");
  await page.getByRole("link", { name: "Open review", exact: true }).click();
  const editorURL = page.url();
  const resultURL = editorURL.replace(/\/edit$/, "");
  await expect(page.getByLabel("What went well this review period?")).toHaveValue(
    /Initial saved note/,
  );
  await page
    .getByLabel("What went well this review period?")
    .fill("Browser demo: clear handoff documentation.");
  await page.getByLabel("How would you rate collaboration?").selectOption("Meets expectations");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved to the database");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, "matt.manager@example.test");
  await page.getByRole("link", { name: "Open review", exact: true }).click();
  await expect(page.getByLabel("What went well this review period?")).toHaveValue(
    "Browser demo: clear handoff documentation.",
  );
  await expect(page.getByLabel("How would you rate collaboration?")).toHaveValue(
    "Meets expectations",
  );
  const employeeContext = await browser.newContext();
  const employee = await employeeContext.newPage();
  await signIn(employee, "jordan.employee@example.test");
  await expect(employee.getByText("No completed review yet.")).toBeVisible();
  await employee.goto(resultURL);
  await expect(
    employee.getByRole("heading", { name: "This review is unavailable." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Complete review", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("next development goal");
  await expect(page.getByRole("alert")).toContainText("Confirm the employee discussion");
  await expect(page.getByLabel("What went well this review period?")).toHaveValue(
    "Browser demo: clear handoff documentation.",
  );
  await page
    .getByLabel("What is the next development goal?")
    .fill("Write an onboarding checklist.");
  await page.route(
    "**/api/reviews/*/save",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Save failed. Last saved data is unchanged.", fields: {} }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Save failed");
  await expect(page.getByLabel("What is the next development goal?")).toHaveValue(
    "Write an onboarding checklist.",
  );
  await expect(page.getByText("Draft saved to the database.", { exact: false })).toHaveCount(0);
  await page.getByLabel("I confirm I discussed this review with the employee.").check();
  await page.getByRole("button", { name: "Complete review", exact: true }).click();
  await expect(page).toHaveURL(resultURL);
  await expect(page.getByText("Completed answers are locked.", { exact: false })).toBeVisible();
  await expect(page.locator("textarea")).toHaveCount(0);
  await employee.goto(resultURL);
  await expect(employee.getByText("Write an onboarding checklist.")).toBeVisible();
  await expect(employee.getByText("Matt Demo", { exact: true })).toBeVisible();
  await expect(employee.getByText("No signed PDF attached.", { exact: false })).toBeVisible();
  await page.screenshot({ path: ".local/evidence/manager-completed.png", fullPage: true });
  await employee.screenshot({ path: ".local/evidence/employee-result.png", fullPage: true });
  await employeeContext.close();
});
test("US-08: incorrect sign-in and HR role screens", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("hr@example.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Email or password incorrect");
  await page.getByLabel("Password", { exact: true }).fill("ReviewFlow!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review operations." })).toBeVisible();
  await page.goto("/manager/reviews");
  await expect(page.getByRole("heading", { name: "This review is unavailable." })).toBeVisible();
});
test("inactivity hides private UI and requires a fresh sign-in", async ({ page }) => {
  await page.clock.install();
  await signIn(page, "hr@example.test");
  await expect(page.getByRole("heading", { name: "Review operations." })).toBeVisible();
  await page.clock.fastForward(900001);
  await expect(page.getByRole("heading", { name: "Sign in to ReviewFlow" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("inactivity");
});
