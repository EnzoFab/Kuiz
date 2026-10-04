import { test, expect } from "@playwright/test";

/**
 * Walks the catalog flow (B17) and plays each B18 template end-to-end. Doubles as a smoke
 * test — if a selector stops matching, the run fails. Captures screenshots for PRs along the
 * way. Output: apps/web/screenshots/NN-*.png.
 *
 * Device-play only (no backend needed); online hosting of a chosen template is covered by
 * the server unit test (realtime.test.ts, "hosts a client-supplied Game").
 */
const DIR = "screenshots";

async function playFromCatalog(page: import("@playwright/test").Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Browse catalog" }).click();
  await page.getByRole("heading", { name: "Catalog" }).waitFor();
  await page.locator("li", { hasText: title }).getByRole("button", { name: "This device" }).click();
  await expect(page.getByRole("button", { name: "Reveal" })).toBeVisible();
}

test("catalog → play Simple Quiz", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: `${DIR}/01-menu.png` });
  await page.getByRole("button", { name: "Browse catalog" }).click();
  await page.getByRole("heading", { name: "Catalog" }).waitFor();
  await page.screenshot({ path: `${DIR}/02-catalog.png`, fullPage: true });

  await page.locator("li", { hasText: "Simple Quiz" }).getByRole("button", { name: "This device" }).click();
  await expect(page.getByRole("button", { name: "Reveal" })).toBeVisible();
  await page.screenshot({ path: `${DIR}/03-play-simple-quiz.png` });
});

test("catalog → play Themed A–Z", async ({ page }) => {
  await playFromCatalog(page, "Themed A–Z: Capitals");
  await page.screenshot({ path: `${DIR}/04-play-az.png` });
});
