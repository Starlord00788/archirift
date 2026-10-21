import path from "node:path";
import { describe, expect, it } from "vitest";
import { bossFight, choiceOrder, initialRiftState } from "@/rift/state";
import { loadValidContent } from "./load";
import { choiceQuestions, findQualityIssues, longestShare, MAX_LONGEST_SHARE, visibleLength } from "./quality";

const { levels } = loadValidContent(path.join(process.cwd(), "content"));
const rifts = levels.filter((l) => l.rift);
const questions = rifts.flatMap((l) => choiceQuestions(l.rift!));

/**
 * Plays every level's boss with a strategy that doesn't read the questions, across many attempts
 * (each attempt reshuffles the choices), and returns the share of fights it wins.
 */
function bossWinRate(pick: (texts: string[]) => number, attempts = 20) {
  let won = 0;
  let fights = 0;
  rifts.forEach((level, l) => {
    const rift = level.rift!;
    for (let n = 0; n < attempts; n += 1) {
      // Every real attempt starts at a different moment, so each gets its own shuffle.
      const startedAt = new Date(Date.UTC(2026, 0, 1) + (l * attempts + n) * 7919).toISOString();
      const state = initialRiftState(level.id, rift, startedAt);
      const answers = rift.boss.questions.map((q, i) => {
        const order = choiceOrder(q.choices.length, `${startedAt}:boss:0:${i}`);
        return order[pick(order.map((c) => q.choices[c].text))];
      });
      won += Number(bossFight(rift, { ...state, beat: "proof", boss: { answers, round: 0 } }).won);
      fights += 1;
    }
  });
  return won / fights;
}

describe("content can't be beaten without reading it", () => {
  it("no right answer gives itself away by being much longer than the wrong ones", () => {
    const issues = rifts.flatMap((l) => findQualityIssues(l.id, l.rift!));
    expect(issues.map((i) => `${i.levelId} ${i.where}: ${i.message}`)).toEqual([]);
  });

  it(`the right answer is the longest option in at most ${MAX_LONGEST_SHARE * 100}% of questions`, () => {
    expect(longestShare(questions)).toBeLessThanOrEqual(MAX_LONGEST_SHARE);
  });

  it("always picking A rarely beats a boss", () => {
    expect(bossWinRate(() => 0)).toBeLessThan(0.3);
  });

  it("always picking the longest answer rarely beats a boss", () => {
    const longest = (texts: string[]) => texts.reduce((best, t, i) => (visibleLength(t) > visibleLength(texts[best]) ? i : best), 0);
    expect(bossWinRate(longest, 1)).toBeLessThan(0.45);
  });
});
