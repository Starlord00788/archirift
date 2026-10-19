import { describe, expect, it } from "vitest";
import { LEGACY_OFFERS, specTotal } from "./domain";
import { LEGACY_DESIGN, applyMove, hydraHeads, runHarness, type Design, type Move } from "./design";

function play(design: Design, ...moves: Move[]): Design {
  return moves.reduce((d, move) => {
    const result = applyMove(d, move);
    if (!result.ok) throw new Error(result.reason);
    return result.design;
  }, design);
}

const withFestival = [...LEGACY_OFFERS, "festival"] as const;

describe("the specification", () => {
  it("applies only the single best offer", () => {
    expect(specTotal({ items: ["latte", "sandwich"], student: true, hour: 16 }, [...LEGACY_OFFERS])).toBe(320);
    expect(specTotal({ items: ["latte", "cookie", "cookie"], student: true, festival: true }, [...withFestival])).toBe(220);
    expect(specTotal({ items: ["latte", "sandwich", "cookie"], student: true, festival: true }, [...withFestival])).toBe(368);
    expect(specTotal({ items: ["cookie"], firstOrder: true }, ["firstOrder"])).toBe(20);
  });
});

describe("the legacy if-else chain", () => {
  it("passes every test before the festival offer exists", () => {
    const report = runHarness(LEGACY_DESIGN, [...LEGACY_OFFERS]);
    expect(report.passed).toBe(report.total);
    expect(report.total).toBe(6);
    expect(hydraHeads(LEGACY_DESIGN)).toBe(3);
  });

  it("fails at least one festival test wherever the new branch is inserted (the pain)", () => {
    for (let position = 0; position <= 3; position += 1) {
      const design = play(LEGACY_DESIGN, { type: "insertBranch", offer: "festival", position });
      const report = runHarness(design, [...withFestival]);
      expect(report.passed, `position ${position}`).toBeLessThan(report.total);
      expect(hydraHeads(design)).toBe(4);
    }
  });
});

describe("refactoring to Strategy", () => {
  const refactor: Move[] = [
    { type: "extractInterface" },
    { type: "moveToClass", offer: "student" },
    { type: "moveToClass", offer: "loyalty" },
    { type: "moveToClass", offer: "happyHour" },
    { type: "injectStrategies" },
  ];

  it("keeps every existing test green at each step", () => {
    let design = LEGACY_DESIGN;
    for (const move of refactor) {
      design = play(design, move);
      const report = runHarness(design, [...LEGACY_OFFERS]);
      expect(report.passed, move.type).toBe(report.total);
    }
    expect(hydraHeads(design)).toBe(0);
  });

  it("refuses moves out of order with a reason", () => {
    const result = applyMove(LEGACY_DESIGN, { type: "moveToClass", offer: "student" });
    expect(result.ok).toBe(false);
    const early = applyMove(play(LEGACY_DESIGN, { type: "extractInterface" }), { type: "injectStrategies" });
    expect(early.ok).toBe(false);
  });

  it("adds the festival offer as a new class with zero edits to existing classes", () => {
    const design = play(LEGACY_DESIGN, ...refactor, { type: "addStrategyClass", offer: "festival" });
    const report = runHarness(design, [...withFestival]);
    expect(report.passed).toBe(report.total);
    expect(report.total).toBe(10);
    expect(report.openClosedViolations).toEqual([]);
  });

  it("flags editing Checkout as an Open/Closed violation even when tests pass", () => {
    const design = play(LEGACY_DESIGN, ...refactor, { type: "editCheckout", offer: "festival" });
    const report = runHarness(design, [...withFestival]);
    expect(report.passed).toBe(report.total);
    expect(report.openClosedViolations).toEqual(["Checkout"]);
  });

  it("absorbs three more offers in a row with every test green (the proof)", () => {
    const design = play(
      LEGACY_DESIGN,
      ...refactor,
      { type: "addStrategyClass", offer: "festival" },
      { type: "addStrategyClass", offer: "monsoon" },
      { type: "addStrategyClass", offer: "combo" },
      { type: "addStrategyClass", offer: "firstOrder" },
    );
    const report = runHarness(design, [...withFestival, "monsoon", "combo", "firstOrder"]);
    expect(report.passed).toBe(report.total);
    expect(report.openClosedViolations).toEqual([]);
  });
});
