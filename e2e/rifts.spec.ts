import { expect, test, type Page } from "@playwright/test";
import { loadValidContent } from "../src/content/load";
import { clozeParts, type Rift, type SimConfig, type Stage } from "../src/content/rift";
import { LRU_SEQUENCE, initialLru, lruAdvance, lruNext } from "../src/rift/labs";

/**
 * Plays every data-driven level end to end in a real browser, the way a learner would: right
 * answers, a winning architecture in every simulation, every lab goal, and a perfect recall.
 * A level that can't be finished (or crashes) fails here.
 */
const { levels } = loadValidContent();
const rifts = levels.filter((l) => l.rift);

/** Text as it renders: Markdown markers stripped, whitespace collapsed. */
const plain = (s: string) => s.replace(/\*\*|`/g, "").replace(/(^|\s)\*(\S[^*]*)\*/g, "$1$2").replace(/\s+/g, " ").trim();
/** Matches an element whose whole text is `s`, so "WHERE a" never matches "WHERE a AND b". */
const whole = (s: string) => new RegExp(`^\\s*${plain(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);

async function clickChoice(page: Page, text: string) {
  await page.locator("button:not([disabled])", { hasText: plain(text) }).first().click();
}

async function playStage(page: Page, stage: Stage, levelId: string) {
  await expect(page.getByRole("heading", { name: stage.title, exact: true })).toBeVisible();
  switch (stage.kind) {
    case "steps":
      for (const step of stage.steps) await clickChoice(page, step.options.find((o) => o.correct)!.text);
      break;
    case "sort":
      for (const item of stage.items) {
        await page.locator("button", { hasText: whole(item.text) }).first().click();
        const bucket = stage.buckets.find((b) => b.id === item.bucket)!;
        await page.getByRole("region", { name: bucket.label, exact: true }).getByRole("button", { name: "Place here" }).click();
      }
      await page.getByRole("button", { name: "Check my sort" }).click();
      break;
    case "order":
      for (let target = 0; target < stage.items.length; target += 1) {
        const item = stage.items[target];
        const names = await page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Move (up|down):/ }) }).allInnerTexts();
        let index = names.findIndex((n) => n.includes(plain(item.text)));
        while (index > target) {
          await page.getByRole("button", { name: `Move up: ${item.text}`, exact: true }).click();
          index -= 1;
        }
      }
      await page.getByRole("button", { name: "Check the order" }).click();
      break;
    case "estimate":
      for (const q of stage.questions) {
        await page.getByPlaceholder("e.g. 12k or 3.5M").first().fill(String(q.answer));
        await page.getByRole("button", { name: "Check", exact: true }).first().click();
      }
      break;
    case "sim":
      await setSim(page, stage.sim.start, stage.sim.solution);
      for (let wave = 1; wave <= stage.sim.waves.length; wave += 1) {
        await page.getByRole("button", { name: `Run wave ${wave}` }).click();
        await page.getByRole("button", { name: "Skip to the result" }).click();
      }
      break;
    case "lab":
      await playLab(page, stage.widget);
      break;
    case "code":
      await page.getByRole("textbox", { name: "Your code" }).fill(stage.solution);
      await page.getByRole("button", { name: "Run tests" }).click();
      await expect(page.getByText(`All ${stage.tests.length} tests pass.`)).toBeVisible();
      break;
  }
  await expect(page.getByRole("button", { name: /Next stage|Face the interview boss/ })).toBeVisible({ timeout: 10_000 });
  void levelId;
}

const KNOB_LABEL: Record<string, string> = {
  servers: "app servers",
  replicas: "read replicas",
  shards: "shards",
  workers: "queue workers",
  cache: "Cache",
  cdn: "CDN",
  queue: "Message queue",
  rateLimit: "Rate limiter",
  breaker: "Circuit breaker",
};

async function setSim(page: Page, start: SimConfig, solution: SimConfig) {
  for (const knob of ["cache", "cdn", "queue", "rateLimit", "breaker"] as const) {
    if (start[knob] !== solution[knob]) await page.getByRole("switch", { name: KNOB_LABEL[knob] }).click();
  }
  if (start.serverSize !== solution.serverSize) await page.getByRole("radio", { name: ["S", "M", "L", "XL"][solution.serverSize - 1], exact: true }).click();
  for (const knob of ["servers", "replicas", "shards", "workers"] as const) {
    const delta = solution[knob] - start[knob];
    const button = page.getByRole("button", { name: `${delta > 0 ? "More" : "Fewer"} ${KNOB_LABEL[knob]}` });
    for (let i = 0; i < Math.abs(delta); i += 1) await button.click();
  }
}

async function playLab(page: Page, widget: string) {
  if (widget === "hashring") {
    await page.getByRole("button", { name: "Add a server" }).click();
    await page.getByRole("radio", { name: "Consistent hash ring" }).click();
    await page.getByRole("radio", { name: "100", exact: true }).click();
    await page.getByRole("button", { name: "Remove a server" }).click();
    await page.getByRole("button", { name: "Add a server" }).click();
  }
  if (widget === "bloom") {
    for (const name of ["arjun", "meera", "kabir", "zoya", "dev", "isha", "rohan", "tara"]) await page.getByRole("button", { name: `+ ${name}` }).click();
    for (const name of ["neel", "asha", "vikram", "lina", "omar", "pia", "sam", "uma", "yash", "noor"]) await page.getByRole("button", { name: `? ${name}` }).click();
    await page.getByRole("radio", { name: "128" }).click();
  }
  if (widget === "token-bucket") {
    await page.getByRole("slider").nth(0).fill("10");
    await page.getByRole("slider").nth(1).fill("4");
  }
  if (widget === "lru") {
    let state = initialLru();
    for (let i = 0; i < LRU_SEQUENCE.length; i += 1) {
      const step = lruNext(state)!;
      if (step.kind === "evict-needed") await page.getByRole("button", { name: `Evict ${step.correct}` }).click();
      else await page.getByRole("button", { name: "Next request" }).click();
      state = lruAdvance(state, step.kind === "evict-needed" ? step.correct : undefined).state;
    }
    await page.getByRole("button", { name: /A hash map from key to node/ }).click();
  }
  if (widget === "race") {
    for (const who of ["Alice", "Bob", "Alice", "Bob", "Alice", "Bob"]) await page.getByRole("button", { name: `Run ${who}'s next step` }).click();
    await page.getByRole("button", { name: "Add a lock around read-check-write" }).click();
    for (let i = 0; i < 5; i += 1) await page.getByRole("button", { name: "Run Alice's next step" }).click();
    for (let i = 0; i < 3; i += 1) await page.getByRole("button", { name: "Run Bob's next step" }).click();
  }
}

async function playRecall(page: Page, rift: Rift) {
  const recall = rift.recall;
  if (recall.kind === "blueprint") {
    for (const node of recall.reference.nodes) await page.getByRole("button", { name: node, exact: true }).click();
    for (const edge of recall.reference.edges) {
      await page.getByRole("combobox", { name: "From" }).selectOption(edge.from);
      await page.getByRole("combobox", { name: "Relationship" }).selectOption(edge.type);
      await page.getByRole("combobox", { name: "To" }).selectOption(edge.to);
      await page.getByRole("button", { name: "Add arrow" }).click();
    }
  } else {
    const blanks = clozeParts(recall.text).filter((p) => p.kind === "blank");
    for (let i = 0; i < blanks.length; i += 1) {
      const blank = blanks[i];
      if (blank.kind === "blank") await page.getByRole("textbox", { name: `Blank ${i + 1}`, exact: true }).fill(blank.answers[0]);
    }
  }
  await page.getByRole("button", { name: "sure", exact: true }).click();
  await page.getByRole("button", { name: "Compare with the reference" }).click();
  await expect(page.getByText("Rebuilt from memory!")).toBeVisible();
}

for (const level of rifts) {
  test(`plays ${level.id} end to end`, async ({ page }) => {
    test.setTimeout(120_000);
    const rift = level.rift!;
    await page.goto(`/levels/${level.id}/`);
    await expect(page.getByRole("heading", { level: 1, name: level.title })).toBeVisible();

    await clickChoice(page, rift.pain.options[0].text);
    await page.getByRole("button", { name: "Into the rift" }).click();

    for (const stage of rift.play) {
      await playStage(page, stage, level.id);
      await page.getByRole("button", { name: /Next stage|Face the interview boss/ }).click();
    }

    for (let q = 0; q < rift.boss.questions.length; q += 1) {
      await clickChoice(page, rift.boss.questions[q].choices.find((c) => c.correct)!.text);
      await page.getByRole("button", { name: q === rift.boss.questions.length - 1 ? "See the result" : "Next question" }).click();
    }
    await expect(page.getByText(`${rift.boss.name} is defeated!`)).toBeVisible();
    await page.getByRole("button", { name: "On to Recall" }).click();

    await playRecall(page, rift);
    await page.getByRole("button", { name: "Seal the rift" }).click();
    await expect(page.getByRole("heading", { name: "The rift is sealed." })).toBeVisible();
    await expect(page.getByText(/first review of .+ is due in \d+ days?/)).toBeVisible();
  });
}
