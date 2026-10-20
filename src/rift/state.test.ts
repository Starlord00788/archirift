import { describe, expect, it } from "vitest";
import { RiftSchema } from "@/content/rift";
import { bossScore, createRiftCodec, createRiftReducer, estimateAccepted, initialRiftState, recallResult, riftXp, seededShuffle, type RiftAction, type RiftState } from "./state";

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
    s = run(s, { type: "toRecall" });
    expect(s.beat).toBe("recall");

    s = run(s, { type: "recallCloze", blank: 0, word: "cache" }, { type: "recallCloze", blank: 1, word: "popular" }, { type: "recallSubmit" });
    expect(s.recall.submitted).toBe(false); // confidence first
    s = run(s, { type: "recallConfidence", confidence: "sure" }, { type: "recallSubmit" }, { type: "finish", at: "2026-01-01T00:05:00Z" });
    expect(s.beat).toBe("reward");
    expect(recallResult(rift, s)).toMatchObject({ kind: "cloze", score: 1, passed: true });
    expect(riftXp(rift, s, 1).total).toBe(100 + 25 + 50 + 20);
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
