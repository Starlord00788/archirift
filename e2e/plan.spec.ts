import { expect, test, type Page } from "@playwright/test";
import { buildCatalog } from "../src/content/catalog";
import { buildDiagnostic } from "../src/content/diagnostic";
import { pathFor } from "../src/game/paths";

/** Goal-based plans, the returning-learner workspace and district skip tests, end to end. */
const catalog = buildCatalog();
const title = (id: string) => catalog.levels.find((l) => l.id === id)!.title;
const plain = (s: string) => s.replace(/\*\*|`/g, "").replace(/(^|\s)\*(\S[^*]*)\*/g, "$1$2").replace(/\s+/g, " ").trim();

async function makePlan(page: Page, track: string, when: string) {
  await page.getByRole("radio", { name: new RegExp(`^${track}`) }).check({ force: true });
  await page.getByRole("radio", { name: new RegExp(`^${when}`) }).check({ force: true });
  await page.getByRole("button", { name: "Make my plan" }).click();
}

async function takeCheck(page: Page, worldId: string, right: (i: number) => boolean) {
  const d = buildDiagnostic(worldId)!;
  await page.goto(`/check/${worldId}/`);
  await page.getByRole("button", { name: "Start the check" }).click();
  for (const [i, q] of d.questions.entries()) {
    await expect(page.getByText(`Question ${i + 1} of ${d.questions.length}`)).toBeVisible();
    const choice = q.choices.find((c) => c.correct === right(i))!;
    await page.locator("button:not([disabled])", { hasText: plain(choice.text) }).first().click();
  }
  return d;
}

test("a first visit makes a plan in two answers, and a returning visit opens on it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Learn system design/ })).toBeVisible();
  await page.getByRole("link", { name: "Make my plan" }).click();

  const path = pathFor({ track: "lld", horizon: "sprint" }, catalog);
  await page.getByRole("radio", { name: /^LLD round/ }).check({ force: true });
  await page.getByRole("radio", { name: /^In about 2 weeks/ }).check({ force: true });
  await expect(page.getByText(`${path.length} levels`)).toBeVisible();
  await page.getByRole("button", { name: "Make my plan" }).click();

  // The page becomes the workspace: next on the plan, not the brochure.
  await expect(page.getByRole("heading", { name: "LLD round, in about 2 weeks" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(title(path[0])) }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Learn system design/ })).toBeHidden();

  await page.reload();
  await expect(page.getByRole("heading", { name: "LLD round, in about 2 weeks" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Learn system design/ })).toBeHidden();

  // Plans can change.
  await page.getByRole("button", { name: "Change plan" }).click();
  await page.getByRole("radio", { name: /^HLD round/ }).check({ force: true });
  await page.getByRole("button", { name: "Update my plan" }).click();
  await expect(page.getByRole("heading", { name: "HLD round, in about 2 weeks" })).toBeVisible();
});

test("passing a skip test takes a district off the plan without sealing anything", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Make my plan" }).click();
  await makePlan(page, "LLD round", "In about 2 weeks");
  await expect(page.getByRole("heading", { name: "LLD round, in about 2 weeks" })).toBeVisible();

  const d = await takeCheck(page, "objects", () => true);
  await expect(page.getByRole("heading", { name: "You know Object Foundry." })).toBeVisible();
  await expect(page.getByText(`${d.questions.length} of ${d.questions.length} right`)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await page.getByRole("link", { name: "Back to my plan" }).click();
  const path = pathFor({ track: "lld", horizon: "sprint" }, catalog);
  const skipped = path.filter((id) => d.levelIds.includes(id));
  await expect(page.getByText(`(${skipped.length} by skip test)`)).toBeVisible();
  const next = path.find((id) => !d.levelIds.includes(id))!;
  await expect(page.getByRole("link", { name: new RegExp(title(next)) }).first()).toBeVisible();

  // On the map they read "tested out", never "completed"; nothing is sealed.
  await page.getByRole("button", { name: /Object Foundry/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Tested out · still playable").first()).toBeVisible();
  await expect(dialog.getByText("Completed")).toHaveCount(0);
});

test("failing a skip test points at the gaps and changes nothing", async ({ page }) => {
  const d = await takeCheck(page, "laws", (i) => i >= 2);
  await expect(page.getByRole("heading", { name: /Not quite yet/ })).toBeVisible();
  await expect(page.getByRole("link", { name: `Start with ${title(d.questions[0].levelId)}` })).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: /Hall of Laws/ }).click();
  await expect(page.getByRole("dialog").getByText("Tested out · still playable")).toHaveCount(0);
});
