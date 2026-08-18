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

test("structured roast form exposes evidence, inverted rating, and flaw tags", async ({ page }) => {
  await page.goto("/write?book=the-alchemist");
  await expect(page.getByRole("heading", { name: "Roast The Alchemist." })).toBeVisible();
  await expect(page.getByLabel("The hook")).toHaveAttribute("minlength", "10");
  await expect(page.getByLabel("The receipts")).toHaveAttribute("minlength", "80");
  await expect(page.getByRole("radio", { name: /Worst/ })).toHaveValue("5");
  await expect(page.getByRole("checkbox", { name: "PROSE" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /16 or older/ })).toHaveCount(0);
});
