import { expect, test } from "@playwright/test";

test("the Atlas explains how concepts connect and travels between them", async ({ page }) => {
  await page.goto("/atlas/?c=replication");
  await expect(page.getByRole("heading", { level: 2, name: "Replication" })).toBeVisible();
  // Typed, explained connections in both directions.
  await expect(page.getByText("Replication enables")).toBeVisible();
  await expect(page.getByText("Replicas can't add write capacity; sharding splits the writes.")).toBeVisible();

  // Travel to a neighbour; the URL follows so the view can be shared.
  await page.getByRole("button", { name: "Sharding", exact: true }).last().click();
  await expect(page.getByRole("heading", { level: 2, name: "Sharding" })).toBeVisible();
  await expect(page).toHaveURL(/c=sharding/);

  // Search narrows the list, including by alias.
  await page.getByPlaceholder(/Search/).fill("raft");
  await expect(page.getByRole("navigation", { name: "Concept list" }).getByRole("button")).toHaveCount(1);
  await page.getByRole("navigation", { name: "Concept list" }).getByRole("button").click();
  await expect(page.getByRole("heading", { level: 2, name: "Consensus and leader election" })).toBeVisible();
  await expect(page.getByRole("link", { name: "The Two Kings" })).toHaveAttribute("href", "/levels/hld-consensus/");
});
