import { expect, test } from "@playwright/test";
import { loadValidContent } from "../src/content/load";

/**
 * Every level's first screen fits a phone. A grid without an explicit column grows to fit its
 * widest child (a long line of sample code), which once pushed 41 levels off the right edge.
 */
const { levels } = loadValidContent();

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("no level's first screen is wider than a phone", async ({ page }) => {
  test.setTimeout(300_000);
  const wide: string[] = [];
  for (const level of levels) {
    await page.goto(`/levels/${level.id}/`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Measured against the visual viewport: mobile emulation widens the layout viewport to fit
    // overflowing content, so innerWidth alone would hide the problem.
    const px = await page.evaluate(() => document.documentElement.scrollWidth - (window.visualViewport?.width ?? window.innerWidth));
    if (px > 0) wide.push(`${level.id} (+${px}px)`);
  }
  expect(wide).toEqual([]);
});
