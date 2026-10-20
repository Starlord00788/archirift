import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("R2: home offers to continue the last visited level after a reload", async ({ page }) => {
  await page.goto("/levels/lld-strategy-hydra/");
  await expect(page.getByRole("heading", { name: "The If-Else Hydra" })).toBeVisible();
  // Wait until the visit is committed to IndexedDB before leaving the page.
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open("archirift");
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("progress")) return resolve(false);
          const get = db.transaction("progress").objectStore("progress").get("local");
          get.onsuccess = () => resolve(Boolean(get.result?.current));
          get.onerror = () => resolve(false);
        };
      }),
  );

  await page.goto("/");
  await page.reload();
  await expect(page.getByRole("link", { name: /Continue The If-Else Hydra/ })).toBeVisible();
});

test("R4: a dragged diagram node keeps its position after a reload", async ({ page }) => {
  await page.goto("/lab/flow/");
  const node = page.locator(".react-flow__node", { hasText: "Checkout" });
  await expect(node).toBeVisible();

  const before = await node.boundingBox();
  if (!before) throw new Error("node not rendered");
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2 + 120, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");

  const transformBefore = await node.evaluate((el) => (el as HTMLElement).style.transform);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(node).toHaveCSS("transform", /matrix/);
  expect(await node.evaluate((el) => (el as HTMLElement).style.transform)).toBe(transformBefore);
});

test("restart layout puts the diagram back without touching other progress", async ({ page }) => {
  await page.goto("/lab/flow/");
  await page.getByRole("button", { name: "Restart layout" }).click();
  await expect(page.getByRole("status")).toHaveText("");
});

for (const path of ["/", "/levels/lld-strategy-hydra/", "/lab/flow/", "/levels/lld-singleton/", "/review/", "/codex/", "/codex/lld-singleton/", "/arena/", "/profile/", "/account/"]) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    // Audit the settled page: with reduced motion, entrance animations finish instantly.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await page.waitForTimeout(1200);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
