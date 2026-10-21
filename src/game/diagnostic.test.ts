import { describe, expect, it } from "vitest";
import { buildDiagnostic } from "@/content/diagnostic";
import { loadValidContent } from "@/content/load";
import { MAX_QUESTIONS, passMark, scoreDiagnostic, spread } from "./diagnostic";

const { worlds, levels } = loadValidContent();

describe("district skip tests", () => {
  it("every district has a short check drawn from across its own levels, each with one right answer", () => {
    for (const world of worlds) {
      const d = buildDiagnostic(world.id)!;
      const own = levels.filter((l) => l.world === world.id);
      expect(d.levelIds).toEqual(own.map((l) => l.id));
      expect(d.questions.length).toBeGreaterThanOrEqual(Math.min(4, own.length));
      expect(d.questions.length).toBeLessThanOrEqual(MAX_QUESTIONS);
      expect(new Set(d.questions.map((q) => q.levelId)).size).toBe(d.questions.length);
      expect(d.questions[0].levelId).toBe(own[0].id);
      for (const q of d.questions) {
        expect(own.some((l) => l.id === q.levelId)).toBe(true);
        expect(q.choices.filter((c) => c.correct)).toHaveLength(1);
      }
    }
  });

  it("spreads its picks from the first item to the last", () => {
    expect(spread([1, 2, 3])).toEqual([1, 2, 3]);
    const picked = spread(Array.from({ length: 17 }, (_, i) => i));
    expect(picked).toHaveLength(6);
    expect(picked[0]).toBe(0);
    expect(picked[5]).toBe(16);
  });

  it("needs all but one right, so a lucky guesser almost never passes", () => {
    expect(passMark(6)).toBe(5);
    expect(passMark(3)).toBe(3);
    // Chance of 5+ of 6 by guessing among 3 choices.
    const p = 1 / 3;
    const chance = 6 * p ** 5 * (1 - p) + p ** 6;
    expect(chance).toBeLessThan(0.02);
  });

  it("scores answers and names the levels that were missed", () => {
    const d = buildDiagnostic("objects")!;
    const right = d.questions.map((q) => q.choices.findIndex((c) => c.correct));
    expect(scoreDiagnostic(d, right)).toMatchObject({ correct: d.questions.length, passed: true, missed: [] });
    const twoWrong = right.map((r, i) => (i < 2 ? (r + 1) % d.questions[i].choices.length : r));
    const result = scoreDiagnostic(d, twoWrong);
    expect(result.passed).toBe(false);
    expect(result.missed).toEqual([d.questions[0].levelId, d.questions[1].levelId]);
  });

  it("is null for an unknown district", () => {
    expect(buildDiagnostic("nowhere")).toBeNull();
  });
});
