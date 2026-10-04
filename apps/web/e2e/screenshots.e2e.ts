import { test } from "@playwright/test";

/**
 * Walks the catalog flow (B17) and captures a screenshot of each screen. Doubles as a smoke
 * test — if a selector stops matching, the run fails. Add a step here when a change is worth
 * showing in a PR. Output: apps/web/screenshots/NN-*.png.
 *
 * Covers device-play from the catalog (no backend needed). Online hosting of a chosen
 * template is covered by the server unit test (realtime.test.ts, "hosts a client-supplied
 * Game"), since it needs the socket server running.
 */
const DIR = "screenshots";

test("catalog → play", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: `${DIR}/01-menu.png` });

  await page.getByRole("button", { name: "Browse catalog" }).click();
  await page.getByRole("heading", { name: "Catalog" }).waitFor();
  await page.screenshot({ path: `${DIR}/02-catalog.png`, fullPage: true });

  // Start the "Friday Night Quiz" template on this device.
  await page
    .locator("li", { hasText: "Friday Night Quiz" })
    .getByRole("button", { name: "This device" })
    .click();
  await page.getByText("Reveal").waitFor();
  await page.screenshot({ path: `${DIR}/03-play-from-catalog.png` });
});
