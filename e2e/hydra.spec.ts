import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const URL = "/levels/lld-strategy-hydra/";

async function savedAfter(page: Page, action: () => Promise<void>) {
  await action();
  await expect(page.getByRole("status").filter({ hasText: "Saved on this device" })).toBeVisible();
}

async function playToRecall(page: Page) {
  await page.getByRole("button", { name: "At the top, before every other offer" }).click();
  await expect(page.getByText(/expected ₹\d+, got ₹\d+/).first()).toBeVisible();
  await page.getByRole("button", { name: "There has to be a better way" }).click();

  await page.getByRole("button", { name: "Extract a PricingStrategy interface" }).click();
  for (const branch of ["student", "loyalty", "happy hour"]) {
    await page.getByRole("button", { name: new RegExp(`Move the ${branch} branch`) }).click();
  }
  await page.getByRole("button", { name: "Give Checkout a list of strategies" }).click();
  await page.getByRole("button", { name: /Add a new FestivalPricing class/ }).click();

  await page.getByRole("button", { name: "Bring them on" }).click();
  for (const name of ["MonsoonPricing", "ComboPricing", "FirstOrderPricing"]) {
    await page.getByRole("button", { name: `Add ${name}` }).click();
  }
  await page.getByRole("button", { name: "When there are only two stable rules that rarely change" }).click();
  await page.getByRole("button", { name: "Continue to the Blank Blueprint" }).click();
}

test("plays the If-Else Hydra end to end, resuming after a reload mid-level", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole("heading", { name: "The If-Else Hydra" })).toBeVisible();

  // Pain beat: the legacy chain fails a client test.
  await savedAfter(page, () => page.getByRole("button", { name: "At the top, before every other offer" }).click());
  await page.getByRole("button", { name: "There has to be a better way" }).click();
  await savedAfter(page, () => page.getByRole("button", { name: "Extract a PricingStrategy interface" }).click());

  // R5: reload mid-level and continue from the same state.
  await page.reload();
  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByRole("button", { name: "Extract a PricingStrategy interface" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Move the student branch/ })).toBeVisible();

  for (const branch of ["student", "loyalty", "happy hour"]) {
    await page.getByRole("button", { name: new RegExp(`Move the ${branch} branch`) }).click();
  }
  await page.getByRole("button", { name: "Give Checkout a list of strategies" }).click();
  await expect(page.getByText(/The Hydra falls/)).toBeVisible();

  // Editing Checkout is refused; adding a class passes every test.
  await page.getByRole("button", { name: /Add the festival rule inside/ }).click();
  await expect(page.getByText(/Open\/Closed check fails/)).toBeVisible();
  await page.getByRole("button", { name: /Add a new FestivalPricing class/ }).click();
  await expect(page.getByText("10/10 passing")).toBeVisible();

  await page.getByRole("button", { name: "Bring them on" }).click();
  for (const name of ["MonsoonPricing", "ComboPricing", "FirstOrderPricing"]) {
    await page.getByRole("button", { name: `Add ${name}` }).click();
  }
  await expect(page.getByText("14/14 passing")).toBeVisible();
  await page.getByRole("button", { name: "When there are only two stable rules that rarely change" }).click();
  await page.getByRole("button", { name: "Continue to the Blank Blueprint" }).click();

  // M3: no diagram, code or reference answer on the page before submission.
  await expect(page.getByRole("tab", { name: "Blueprint" })).toHaveCount(0);
  await expect(page.getByText("Compared with the reference")).toHaveCount(0);

  for (const name of ["Checkout", "PricingStrategy", "StudentPricing", "LoyaltyPricing", "HappyHourPricing", "FestivalPricing"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  const addArrow = async (from: string, relation: string, to: string) => {
    await page.getByRole("combobox", { name: "From" }).selectOption(from);
    await page.getByRole("combobox", { name: "Relationship" }).selectOption(relation);
    await page.getByRole("combobox", { name: "To" }).selectOption(to);
    await page.getByRole("button", { name: "Add arrow" }).click();
  };
  await addArrow("Checkout", "uses", "PricingStrategy");
  for (const cls of ["StudentPricing", "LoyaltyPricing", "HappyHourPricing"]) await addArrow(cls, "implements", "PricingStrategy");
  await addArrow("FestivalPricing", "extends", "PricingStrategy");
  await page.getByRole("button", { name: "sure", exact: true }).click();
  await page.getByRole("button", { name: "Compare with the reference" }).click();

  await expect(page.getByText(/FestivalPricing extends PricingStrategy: should be “implements”/)).toBeVisible();
  await page.getByRole("button", { name: /Checkout depends only on the PricingStrategy interface/ }).click();
  await page.getByRole("button", { name: "Finish the level" }).click();

  await expect(page.getByRole("heading", { name: "The rift is sealed." })).toBeVisible();
  await expect(page.getByText(/first review of Strategy is due in \d+ days?/)).toBeVisible();

  // R1: completion survives a reload; the level does not restart into a stale attempt.
  await page.goto("/");
  await page.reload();
  await expect(page.getByRole("link", { name: /The If-Else Hydra\s*Completed/ })).toBeVisible();
});

test("R6: starting a fresh attempt keeps nothing from the old one in the level", async ({ page }) => {
  await page.goto(URL);
  await savedAfter(page, () => page.getByRole("button", { name: "After the student branch" }).click());
  await page.reload();
  await page.getByRole("button", { name: "Start a fresh attempt" }).click();
  await expect(page.getByRole("button", { name: "There has to be a better way" })).toHaveCount(0);
});

test("the recall beat has no serious accessibility violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL);
  await playToRecall(page);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("the play beat has no serious accessibility violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL);
  await page.getByRole("button", { name: "At the top, before every other offer" }).click();
  await page.getByRole("button", { name: "There has to be a better way" }).click();
  for (const tab of ["Story", "Blueprint", "Code"]) {
    await page.getByRole("tab", { name: tab }).click();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${tab}: ${v.id}: ${v.help}`)).toEqual([]);
  }
});
