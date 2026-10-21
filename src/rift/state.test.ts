import { describe, expect, it } from "vitest";
import { RiftSchema } from "@/content/rift";
import {
  bossFight,
  bossScore,
  choiceOrder,
  clozeMatch,
  clozeSkeleton,
  createRiftCodec,
  createRiftReducer,
  estimateAccepted,
  initialRiftState,
  PRACTICE_XP,
  recallResult,
  riftOutcome,
  riftXp,
  seededShuffle,
  type RiftAction,
  type RiftState,
} from "./state";

const rift = RiftSchema.parse({
  pain: { scene: "s", prompt: "p", options: [{ text: "a", outcome: "o" }, { text: "b", outcome: "o2" }], lesson: "l" },
  play: [
    { kind: "steps", title: "t", intro: "i", steps: [{ prompt: "p", options: [{ text: "wrong", feedback: "no" }, { text: "right", correct: true, feedback: "yes" }] }] },
    { kind: "sort", title: "t", intro: "i", buckets: [{ id: "x", label: "X" }, { id: "y", label: "Y" }], items: [{ id: "1", text: "one", bucket: "x", why: "w" }, { id: "2", text: "two", bucket: "y", why: "w" }, { id: "3", text: "three", bucket: "x", why: "w" }] },
    { kind: "order", title: "t", intro: "i", items: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }] },
    { kind: "estimate", title: "t", intro: "i", questions: [{ id: "q", prompt: "p", answer: 1000, unit: "rps", working: "w" }] },
  ],
  boss: { name: "B", taunt: "t", questions: [{ prompt: "q1", choices: [{ text: "a", correct: true, why: "w" }, { text: "b", why: "w" }] }, { prompt: "q2", choices: [{ text: "a", why: "w" }, { text: "b", correct: true, why: "w" }] }] },
  recall: { kind: "cloze", prompt: "p", text: "A [[cache]] keeps [[hot|popular]] data.", bank: ["cache", "hot", "cold", "queue"] },
  codex: { oneLiner: "o", analogy: "a", keyPoints: ["k", "k2"], whenToUse: ["w"], whenNotToUse: ["n"], interviewTells: ["t"] },
});

const reduce = createRiftReducer("lvl", rift);
const run = (state: RiftState, ...actions: RiftAction[]) => actions.reduce(reduce, state);
const fresh = () => initialRiftState("lvl", rift, "2026-01-01T00:00:00Z");

describe("rift reducer", () => {
  it("plays a whole level and scores it", () => {
    let s = run(fresh(), { type: "painTry", option: 1 }, { type: "toPlay" });
    expect(s.beat).toBe("play");

    s = run(s, { type: "stepChoose", option: 0 });
    expect(s.missteps).toBe(1);
    expect(s.feedback?.tone).toBe("bad");
    s = run(s, { type: "stepChoose", option: 1 }, { type: "nextStage" });
    expect(s.stage).toBe(1);

    s = run(s, { type: "sortPlace", item: "1", bucket: "x" }, { type: "sortPlace", item: "2", bucket: "x" }, { type: "sortPlace", item: "3", bucket: "x" }, { type: "sortCheck" });
    expect(s.stages[1].done).toBe(false);
    expect(s.missteps).toBe(2);
    s = run(s, { type: "sortPlace", item: "2", bucket: "y" }, { type: "sortCheck" }, { type: "nextStage" });

    s = run(s, { type: "orderSet", order: ["a", "b", "c"] }, { type: "orderCheck" }, { type: "nextStage" });
    expect(s.stage).toBe(3);

    s = run(s, { type: "estimateAnswer", question: "q", value: 10 }, { type: "estimateCheck", question: "q" });
    expect(s.stages[3].done).toBe(false);
    s = run(s, { type: "estimateAnswer", question: "q", value: 1500 }, { type: "estimateCheck", question: "q" }, { type: "nextStage" });
    expect(s.beat).toBe("proof");

    // Boss questions are answered in order, once each.
    expect(run(s, { type: "bossAnswer", question: 1, choice: 1 }).boss.answers).toEqual([null, null]);
    s = run(s, { type: "bossAnswer", question: 0, choice: 0 }, { type: "bossAnswer", question: 0, choice: 1 }, { type: "bossAnswer", question: 1, choice: 0 });
    expect(bossScore(rift, s)).toEqual({ right: 1, total: 2 });
    // Two questions: both must land, so one wrong answer breaks the only shield and the boss wins.
    expect(bossFight(rift, s)).toMatchObject({ need: 2, shields: 1, over: true, won: false });
    s = run(s, { type: "bossRematch" });
    expect(s.boss).toEqual({ answers: [null, null], round: 1 });
    s = run(s, { type: "bossAnswer", question: 0, choice: 0 }, { type: "bossAnswer", question: 1, choice: 1 });
    expect(bossFight(rift, s).won).toBe(true);
    expect(run(s, { type: "bossRematch" }).boss.round).toBe(1); // no rematch after a win
    s = run(s, { type: "toRecall" });
    expect(s.beat).toBe("recall");

    s = run(s, { type: "recallCloze", blank: 0, word: "cache" }, { type: "recallCloze", blank: 1, word: "popular" }, { type: "recallSubmit" });
    expect(s.recall.submitted).toBe(false); // confidence first
    s = run(s, { type: "recallConfidence", confidence: "sure" }, { type: "recallSubmit" }, { type: "finish", at: "2026-01-01T00:05:00Z" });
    expect(s.beat).toBe("reward");
    expect(recallResult(rift, s)).toMatchObject({ kind: "cloze", score: 1, passed: true });
    expect(riftOutcome(rift, s)).toMatchObject({ sealed: true, flawless: false });
    // Base 100, a rematch halves the boss bonus (25), recall 50, no hints 20.
    expect(riftXp(rift, s, 1).total).toBe(100 + 25 + 50 + 20);
  });

  it("ends the fight early when the shields run out and stops taking answers", () => {
    const three = RiftSchema.parse({
      ...rift,
      boss: { ...rift.boss, questions: [0, 1, 2].map((n) => ({ prompt: `q${n}`, choices: [{ text: "right", correct: true, why: "w" }, { text: "wrong", why: "w" }] })) },
    });
    const r = createRiftReducer("lvl", three);
    const actions: RiftAction[] = [
      { type: "bossAnswer", question: 0, choice: 1 },
      { type: "bossAnswer", question: 1, choice: 1 },
    ];
    const s = actions.reduce(r, { ...initialRiftState("lvl", three, "2026-01-01T00:00:00Z"), beat: "proof" });
    expect(bossFight(three, s)).toMatchObject({ need: 2, shields: 2, shieldsLeft: 0, over: true, won: false });
    expect(r(s, { type: "bossAnswer", question: 2, choice: 0 }).boss.answers[2]).toBeNull();
    expect(r(s, { type: "toRecall" }).beat).toBe("recall");
  });

  it("doesn't seal a rift whose boss won: the attempt earns practice XP only", () => {
    let s = run(fresh(), { type: "painTry", option: 0 }, { type: "toPlay" });
    s = { ...s, beat: "proof" };
    s = run(s, { type: "bossAnswer", question: 0, choice: 1 }, { type: "toRecall" });
    s = run(s, { type: "recallCloze", blank: 0, word: "cache" }, { type: "recallCloze", blank: 1, word: "hot" }, { type: "recallConfidence", confidence: "sure" }, { type: "recallSubmit" });
    expect(riftOutcome(rift, s)).toMatchObject({ sealed: false, flawless: false });
    expect(riftXp(rift, s, 3).total).toBe(PRACTICE_XP);
  });

  it("checks typed recall answers by idea, not by exact spelling", () => {
    expect(clozeMatch(["load balancer"], "Load-Balancer")).toBe(true);
    expect(clozeMatch(["normalisation"], "normalization")).toBe(true);
    expect(clozeMatch(["cache"], "caches")).toBe(true);
    expect(clozeMatch(["100,000", "100k"], "100000")).toBe(true);
    expect(clozeMatch(["R + W > N"], "r+w>n")).toBe(true);
    expect(clozeMatch(["TCP"], "UDP")).toBe(false);
    expect(clozeMatch(["static"], "public")).toBe(false);
    expect(clozeMatch(["cache"], "")).toBe(false);
    expect(clozeSkeleton("load balancer")).toBe("l___ b_______");
  });

  it("first letters and then the word bank each cost a hint, and stop at two", () => {
    let s = run(fresh(), { type: "painTry", option: 0 });
    s = { ...s, beat: "recall" };
    s = run(s, { type: "recallScaffold" }, { type: "recallScaffold" }, { type: "recallScaffold" });
    expect(s.recall.scaffold).toBe(2);
    expect(s.hintsUsed).toBe(2);
  });

  it("gives a hint that rules out a wrong step option and counts it", () => {
    const s = run(fresh(), { type: "painTry", option: 0 }, { type: "toPlay" }, { type: "hint" });
    expect(s.hintsUsed).toBe(1);
    expect(s.feedback?.text).toContain("wrong");
  });

  it("restores a saved state and rejects one from a differently shaped level", () => {
    const codec = createRiftCodec(rift);
    const saved = JSON.parse(JSON.stringify(run(fresh(), { type: "painTry", option: 0 })));
    expect(codec.migrate(saved, 1)?.painTried).toEqual([0]);
    expect(codec.migrate({ ...saved, shape: "other" }, 1)).toBeNull();
    expect(codec.migrate(saved, 99)).toBeNull();
    expect(codec.migrate({ nonsense: true }, 1)).toBeNull();
  });
});

describe("choice order", () => {
  it("puts the right answer on every letter about equally often, including for two options", () => {
    for (const count of [2, 3, 4]) {
      const at = new Array(count).fill(0);
      for (let n = 0; n < 4000; n += 1) at[choiceOrder(count, `seed-${n}`).indexOf(0)] += 1;
      for (const hits of at) expect(Math.abs(hits / 4000 - 1 / count)).toBeLessThan(0.04);
    }
  });

  it("is a stable permutation for a given seed", () => {
    expect(choiceOrder(4, "x")).toEqual(choiceOrder(4, "x"));
    expect([...choiceOrder(5, "y")].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("ids that collide with Object.prototype", () => {
  it("treats an item called “constructor” as unplaced until it is placed", () => {
    const tricky = RiftSchema.parse({
      ...rift,
      play: [{ kind: "sort", title: "t", intro: "i", buckets: [{ id: "x", label: "X" }, { id: "y", label: "Y" }], items: [{ id: "constructor", text: "c", bucket: "x", why: "w" }, { id: "to-string", text: "t", bucket: "y", why: "w" }, { id: "a", text: "a", bucket: "x", why: "w" }] }],
    });
    const r = createRiftReducer("t", tricky);
    let s = r(r(initialRiftState("t", tricky, "2026-01-01T00:00:00Z"), { type: "painTry", option: 0 }), { type: "toPlay" });
    s = r(r(r(s, { type: "sortPlace", item: "a", bucket: "x" }), { type: "sortPlace", item: "to-string", bucket: "y" }), { type: "sortCheck" });
    expect(s.feedback?.text).toBe("1 still to place.");
    s = r(r(s, { type: "sortPlace", item: "constructor", bucket: "x" }), { type: "sortCheck" });
    expect(s.stages[0].done).toBe(true);
  });
});

describe("helpers", () => {
  it("accepts estimates within the tolerance factor", () => {
    expect(estimateAccepted(1000, 1900, 2)).toBe(true);
    expect(estimateAccepted(1000, 501, 2)).toBe(true);
    expect(estimateAccepted(1000, 2100, 2)).toBe(false);
    expect(estimateAccepted(1000, 0, 2)).toBe(false);
  });

  it("shuffles deterministically and never returns the original order", () => {
    const items = ["a", "b", "c", "d"];
    expect(seededShuffle(items, "seed")).toEqual(seededShuffle(items, "seed"));
    expect(seededShuffle(items, "seed")).not.toEqual(items);
    expect([...seededShuffle(items, "x")].sort()).toEqual(items);
  });
});
