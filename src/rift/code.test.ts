import { describe, expect, it } from "vitest";
import { runCodeTests } from "./code";
import { createRiftReducer, initialRiftState } from "./state";
import type { Rift } from "@/content/rift";

const tests = [
  { name: "adds", code: "assertEqual(add(2, 3), 5);" },
  { name: "handles negatives", code: "assertEqual(add(-2, 1), -1, 'negative');" },
];

describe("runCodeTests", () => {
  it("passes correct code and reports each test", () => {
    expect(runCodeTests("", "function add(a, b) { return a + b; }", tests)).toEqual([
      { name: "adds", passed: true, message: "Passed" },
      { name: "handles negatives", passed: true, message: "Passed" },
    ]);
  });

  it("explains failures with expected and actual values", () => {
    const [first] = runCodeTests("", "function add(a, b) { return a - b; }", tests);
    expect(first.passed).toBe(false);
    expect(first.message).toBe("expected 5, got -1");
  });

  it("reports syntax errors instead of throwing", () => {
    const results = runCodeTests("", "function add(a, b) { return a + ; }", tests);
    expect(results.every((r) => !r.passed && r.message.startsWith("SyntaxError"))).toBe(true);
  });

  it("runs given code before the learner's code, in a fresh scope per test", () => {
    const counter = [{ name: "fresh", code: "assertEqual(bump(), 1);" }, { name: "still fresh", code: "assertEqual(bump(), 1);" }];
    const results = runCodeTests("let n = 0;", "function bump() { n += 1; return n; }", counter);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("is self-contained, so it can be serialised into a worker", () => {
    const rebuilt = new Function(`return (${runCodeTests.toString()})`)() as typeof runCodeTests;
    expect(rebuilt("", "function add(a, b) { return a + b; }", tests).every((r) => r.passed)).toBe(true);
  });
});

describe("code stage state", () => {
  const rift = {
    pain: { scene: "s", prompt: "p", options: [{ text: "o", outcome: "o" }], lesson: "l" },
    play: [{ kind: "code", title: "t", intro: "i", given: "", starter: "function add(a, b) {}", solution: "function add(a, b) { return a + b; }", tests }],
    boss: { name: "b", taunt: "t", questions: [{ prompt: "q", choices: [{ text: "a", correct: true, why: "w" }, { text: "b", correct: false, why: "w" }] }] },
    recall: { kind: "cloze", prompt: "p", text: "a [[b]]", bank: ["b", "c"] },
    codex: { oneLiner: "o", analogy: "a", keyPoints: ["k"], whenToUse: ["w"], whenNotToUse: ["w"], interviewTells: ["i"], pitfalls: ["p"] },
    cards: [],
  } as unknown as Rift;
  const reduce = createRiftReducer("lvl", rift);
  const start = { ...initialRiftState("lvl", rift, "2026-01-01T00:00:00Z"), beat: "play" as const };

  it("starts with the starter code and finishes only when every test passes", () => {
    expect(start.stages[0]).toMatchObject({ kind: "code", source: "function add(a, b) {}", done: false });
    const failing = reduce(start, { type: "codeResults", results: runCodeTests("", "function add(a, b) {}", tests) });
    expect(failing.stages[0].done).toBe(false);
    expect(failing.missteps).toBe(1);
    const edited = reduce(failing, { type: "codeEdit", source: "function add(a, b) { return a + b; }" });
    const passing = reduce(edited, { type: "codeResults", results: runCodeTests("", "function add(a, b) { return a + b; }", tests) });
    expect(passing.stages[0].done).toBe(true);
    expect(reduce(passing, { type: "codeEdit", source: "x" }).stages[0]).toMatchObject({ source: "function add(a, b) { return a + b; }" });
  });

  it("resets to the starter code", () => {
    const edited = reduce(start, { type: "codeEdit", source: "oops" });
    expect(reduce(edited, { type: "codeReset" }).stages[0]).toMatchObject({ source: "function add(a, b) {}", results: null });
  });
});

describe("assertEqual", () => {
  it("ignores object key order", () => {
    const t = [{ name: "order", code: "assertEqual({ b: 1, a: 2 }, { a: 2, b: 1 });" }];
    expect(runCodeTests("", "", t)[0].passed).toBe(true);
  });
});
