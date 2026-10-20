import { describe, expect, it } from "vitest";
import { runHarness } from "./design";
import { hydraCodec, initialState, reduce, REFERENCE, type Action, type HydraState } from "./level";

const T0 = "2026-11-10T10:00:00.000Z";
const T20 = "2026-11-10T10:00:20.000Z";

function run(state: HydraState, ...actions: Action[]): HydraState {
  return actions.reduce(reduce, state);
}

const toProof: Action[] = [
  { type: "painInsert", position: 0 },
  { type: "toPlay" },
  { type: "move", move: { type: "extractInterface" } },
  { type: "move", move: { type: "moveToClass", offer: "student" } },
  { type: "move", move: { type: "moveToClass", offer: "loyalty" } },
  { type: "move", move: { type: "moveToClass", offer: "happyHour" } },
  { type: "move", move: { type: "injectStrategies" } },
  { type: "addFestival", how: "class" },
];

const toRecall: Action[] = [
  ...toProof,
  { type: "startProof", at: T0 },
  { type: "proofAdd", how: "class", at: T0 },
  { type: "proofAdd", how: "class", at: T0 },
  { type: "proofAdd", how: "class", at: T20 },
  { type: "answerInterview", choiceId: "stable" },
  { type: "toRecall" },
];

function rebuildPerfectly(state: HydraState): HydraState {
  const nodes: Action[] = REFERENCE.nodes.map((name) => ({ type: "recallAddNode", name }));
  const edges: Action[] = REFERENCE.edges.map((e) => ({ type: "recallAddEdge", from: e.from, to: e.to, relation: e.type }));
  return run(state, ...nodes, ...edges, { type: "recallConfidence", confidence: "sure" }, { type: "recallSubmit" });
}

describe("the Hydra level flow", () => {
  it("cannot leave the pain beat before trying at least once", () => {
    expect(reduce(initialState(T0), { type: "toPlay" }).beat).toBe("pain");
    const tried = run(initialState(T0), { type: "painInsert", position: 1 });
    expect(tried.painTries).toEqual([1]);
    expect(runHarness(tried.design, tried.requested).passed).toBeLessThan(runHarness(tried.design, tried.requested).total);
  });

  it("counts an out-of-order refactoring move as a misstep and explains why", () => {
    const state = run(initialState(T0), { type: "painInsert", position: 0 }, { type: "toPlay" }, { type: "move", move: { type: "injectStrategies" } });
    expect(state.missteps).toBe(1);
    expect(state.feedback?.tone).toBe("bad");
  });

  it("rejects adding the festival offer by editing Checkout, and stays in play", () => {
    const beforeFestival = run(initialState(T0), ...toProof.slice(0, -1));
    const edited = reduce(beforeFestival, { type: "addFestival", how: "edit" });
    expect(edited.beat).toBe("play");
    expect(edited.design.inlineAdditions).toEqual([]);
    expect(edited.missteps).toBe(1);
  });

  it("reaches proof with every requested scenario passing and no Open/Closed violations", () => {
    const state = run(initialState(T0), ...toProof);
    expect(state.beat).toBe("proof");
    const report = runHarness(state.design, state.requested);
    expect(report.passed).toBe(report.total);
    expect(report.openClosedViolations).toEqual([]);
  });

  it("absorbs three more offers in proof and times the run", () => {
    const state = run(initialState(T0), ...toRecall);
    expect(state.beat).toBe("recall");
    expect(state.proof.seconds).toBe(20);
    const report = runHarness(state.design, state.requested);
    expect(report.total).toBe(14);
    expect(report.passed).toBe(14);
  });

  it("keeps the answer out of the state until the rebuild is submitted, then scores it", () => {
    const recall = run(initialState(T0), ...toRecall);
    expect(recall.recall.diff).toBeNull();
    expect(reduce(recall, { type: "recallSubmit" }).recall.diff).toBeNull(); // needs nodes and confidence
    const submitted = rebuildPerfectly(recall);
    expect(submitted.recall.diff?.scores).toEqual({ concepts: 1, relationships: 1, types: 1 });
    // A submitted rebuild can no longer be changed.
    expect(reduce(submitted, { type: "recallAddNode", name: "Extra" }).recall.graph.nodes).toHaveLength(6);
  });

  it("finishes only after the elaboration question", () => {
    const submitted = rebuildPerfectly(run(initialState(T0), ...toRecall));
    expect(reduce(submitted, { type: "finish" }).beat).toBe("recall");
    const done = run(submitted, { type: "elaborate", choiceId: "interface" }, { type: "finish" });
    expect(done.beat).toBe("reward");
  });
});

describe("hydraCodec", () => {
  it("round-trips a mid-level state exactly", () => {
    const state = run(initialState(T0), ...toProof, { type: "startProof", at: T0 }, { type: "proofAdd", how: "class", at: T0 });
    const restored = hydraCodec.migrate(JSON.parse(JSON.stringify(state)), 1);
    expect(restored).toEqual(state);
  });

  it("rejects corrupted or unknown-version state", () => {
    expect(hydraCodec.migrate({ beat: "boss-fight" }, 1)).toBeNull();
    expect(hydraCodec.migrate(initialState(T0), 99)).toBeNull();
  });
});
