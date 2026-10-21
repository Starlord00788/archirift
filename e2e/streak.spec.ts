import { expect, test, type Page } from "@playwright/test";
import { loadValidContent } from "../src/content/load";

/** A streak starts with real study, never with a visit. */
const level = loadValidContent().levels.find((l) => l.id === "lld-classes-objects")!;
const rift = level.rift!;
const plain = (s: string) => s.replace(/\*\*|`/g, "").replace(/\s+/g, " ").trim();
const streak = (page: Page) => page.locator("header").getByRole("link", { name: /day streak/ });

test("visiting, planning and opening a level keep the streak at 0; the first answer makes it 1", async ({ page }) => {
  await page.goto("/");
  await expect(streak(page)).toHaveText(/^0(?!\d)/);
  for (const path of ["/codex/", "/atlas/", "/arena/", "/review/"]) await page.goto(path);
  await expect(streak(page)).toHaveText(/^0(?!\d)/);

  await page.goto("/");
  await page.getByRole("link", { name: "Make my plan" }).click();
  await page.getByRole("radio", { name: /^LLD round/ }).check({ force: true });
  await page.getByRole("radio", { name: /^In about 2 weeks/ }).check({ force: true });
  await page.getByRole("button", { name: "Make my plan" }).click();
  await expect(page.getByRole("heading", { name: "LLD round, in about 2 weeks" })).toBeVisible();
  await expect(streak(page)).toHaveText(/^0(?!\d)/);

  // Opening a level, trying the ungraded Pain choices and taking a hint aren't studying yet.
  await page.goto(`/levels/${level.id}/`);
  await page.locator("button:not([disabled])", { hasText: plain(rift.pain.options[1].text) }).first().click();
  await page.getByRole("button", { name: "Into the rift" }).click();
  await page.getByRole("button", { name: "Hint" }).click();
  await page.waitForTimeout(500);
  await expect(streak(page)).toHaveText(/^0(?!\d)/);

  // Answering is. Even a wrong answer counts as studying.
  const steps = rift.play[0];
  if (steps.kind !== "steps") throw new Error("expected a steps stage");
  await page.locator("button:not([disabled])", { hasText: plain(steps.steps[0].options.find((o) => !o.correct)!.text) }).first().click();
  await expect(streak(page)).toHaveText(/^1(?!\d)/);

  await page.reload();
  await expect(streak(page)).toHaveText(/^1(?!\d)/);
  await expect(streak(page)).toHaveAttribute("title", /You've studied today/);
});
