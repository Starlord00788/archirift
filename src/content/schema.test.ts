import { describe, expect, it } from "vitest";
import path from "node:path";
import { findContentProblems, type ContentBundle } from "./schema";
import { loadValidContent } from "./load";

const base: ContentBundle = {
  concepts: [
    { id: "strategy", name: "Strategy", tier: "core", world: "w", rule: "r", aliases: [], misconceptions: [] },
    { id: "state", name: "State", tier: "core", world: "w", rule: "r", aliases: [], misconceptions: [] },
  ],
  edges: [{ from: "strategy", to: "state", type: "contrasts-with", explanation: "e" }],
  levels: [
    {
      id: "lvl",
      title: "t",
      summary: "s",
      world: "w",
      type: "refactor-rush",
      concepts: ["strategy"],
      prerequisites: [],
      minutes: 5,
      primaryVisual: "class-diagram",
      beats: ["pain", "play", "proof", "recall"],
      blankBlueprint: true,
      whenNotToUse: "w",
    },
  ],
};

describe("findContentProblems", () => {
  it("accepts consistent content", () => {
    expect(findContentProblems(base)).toEqual([]);
  });

  it("rejects an edge to an unknown concept", () => {
    const bundle = { ...base, edges: [{ ...base.edges[0], to: "ghost" }] };
    expect(findContentProblems(bundle)).toContain('edge strategy -> ghost uses unknown concept "ghost"');
  });

  it("rejects a level missing the recall beat", () => {
    const bundle: ContentBundle = { ...base, levels: [{ ...base.levels[0], beats: ["pain", "play", "proof"] }] };
    expect(findContentProblems(bundle)).toContain('level "lvl" is missing the "recall" beat');
  });

  it("rejects a level without a Blank Blueprint", () => {
    const bundle = { ...base, levels: [{ ...base.levels[0], blankBlueprint: false }] };
    expect(findContentProblems(bundle)).toContain('level "lvl" has no Blank Blueprint');
  });
});

describe("repository content", () => {
  it("loads and validates", () => {
    const content = loadValidContent(path.join(process.cwd(), "content"));
    expect(content.levels.map((level) => level.id)).toContain("lld-strategy-hydra");
  });
});
