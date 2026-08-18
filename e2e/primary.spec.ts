import { expect, test } from "@playwright/test";

/*
 * These smoke journeys exercise the public discovery path and the structured
 * roast form in a real Chromium session. Mutation-heavy moderation cases live
 * in domain tests so browser runs stay repeatable against a reused dev server.
 */

test("home and search expose indexable book discovery", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Badreads/);
  await expect(page.getByRole("heading", { name: "Books that let you down." })).toBeVisible();

  await page.getByRole("link", { name: "Find a book" }).click();
  await page.getByRole("searchbox", { name: "Search books" }).fill("Alchemist");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("link", { name: /The Alchemist/ })).toHaveAttribute("href", "/books/the-alchemist");
});

test("bottom 100 ranking page exposes ranked books and badness indicators", async ({ page }) => {
  await page.goto("/bottom-100");
  await expect(page).toHaveTitle(/Bottom 100/);
  await expect(page.getByRole("heading", { name: /Bottom 100/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Worst Badness/ })).toBeVisible();
});

test("sign-in page exposes authentication surface according to runtime mode", async ({ page }) => {
  await page.goto("/sign-in");
  const isDemo = await page.getByText("Local demo / no email required").isVisible().catch(() => false);
  if (isDemo) {
    await expect(page.getByRole("link", { name: "Continue in local demo" })).toHaveAttribute("href", "/write");
    await expect(page.getByLabel("Email address")).toHaveCount(0);
  } else {
    await expect(page.getByRole("heading", { name: /Come say the quiet part/ })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Email address/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Send me a magic link/ })).toBeVisible();
  }
});
