import { test } from "@playwright/test";

/**
 * Walks the B16 authoring flow and captures a screenshot of each screen. Doubles as a smoke
 * test — if a selector stops matching, the run fails. Add a step here when a change is worth
 * showing in a PR. Output: apps/web/screenshots/NN-*.png.
 */
const DIR = "screenshots";

test("authoring composer walkthrough", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: `${DIR}/01-menu.png` });

  await page.getByRole("button", { name: "Create / edit games" }).click();
  await page.screenshot({ path: `${DIR}/02-your-games.png` });

  await page.getByRole("button", { name: "Friday Night Quiz" }).click();
  await page.getByText("Answer type").first().waitFor();
  await page.screenshot({ path: `${DIR}/03-editor.png`, fullPage: true });

  await page.getByRole("button", { name: "Play" }).click();
  await page.getByText("Reveal").waitFor();
  await page.screenshot({ path: `${DIR}/04-play.png` });
});
