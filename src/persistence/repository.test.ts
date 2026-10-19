import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArchiriftDB } from "./db";
import { DexieLearningRepository, StaleWriteError, type SnapshotCodec } from "./repository";
import { withRetry } from "./retry";
import type { LearningEvent } from "./types";

let dbName: string;
let db: ArchiriftDB;
let repo: DexieLearningRepository;
const clock = () => new Date("2026-11-10T10:00:00Z");

beforeEach(() => {
  dbName = `test-${Math.random()}`;
  db = new ArchiriftDB(dbName);
  repo = new DexieLearningRepository(db, clock);
});

afterEach(async () => {
  db.close();
  await ArchiriftDB.delete(dbName);
});

/** Simulates a page reload: a brand-new connection to the same database. */
function reopen() {
  db.close();
  db = new ArchiriftDB(dbName);
  repo = new DexieLearningRepository(db, clock);
}

const completed: LearningEvent = {
  id: "lessonCompleted:lld-strategy-hydra",
  type: "lessonCompleted",
  lessonId: "lld-strategy-hydra",
  at: "2026-11-10T10:00:00Z",
};

const attempt: LearningEvent = {
  id: "attempt:a1",
  type: "attemptSubmitted",
  attemptId: "a1",
  itemId: "card:strategy:pick-and-defend:1",
  correct: true,
  confidence: "sure",
  hintsUsed: 0,
  seconds: 30,
  at: "2026-11-10T10:01:00Z",
};

// A tiny codec for a diagram exercise: v1 stored `nodes`, v2 renamed it to `diagram.nodes`.
interface DiagramState {
  diagram: { nodes: { id: string; x: number; y: number }[] };
  stage: string;
}
const codec: SnapshotCodec<DiagramState> = {
  currentVersion: 2,
  migrate(state, fromVersion) {
    const value = state as Record<string, unknown>;
    if (fromVersion === 1 && Array.isArray(value?.nodes) && typeof value.stage === "string") {
      return { diagram: { nodes: value.nodes as DiagramState["diagram"]["nodes"] }, stage: value.stage };
    }
    if (fromVersion === 2 && value?.diagram && typeof value.stage === "string") return value as unknown as DiagramState;
    return null;
  },
};
const diagram: DiagramState = {
  diagram: { nodes: [{ id: "Checkout", x: 120, y: 80 }, { id: "PricingStrategy", x: 320, y: 80 }] },
  stage: "play",
};

describe("learning progress (stage 1)", () => {
  it("R1: a completed lesson is still completed after a reload", async () => {
    await repo.recordEvent(completed);
    reopen();
    expect((await repo.getProgress()).completedLessons).toEqual(["lld-strategy-hydra"]);
  });

  it("R2: resumes at the last visited activity", async () => {
    await repo.recordEvent({ id: "visit:1", type: "activityVisited", lessonId: "lld-strategy-hydra", activity: "play", at: "2026-11-10T10:00:00Z" });
    await repo.recordEvent({ id: "visit:2", type: "activityVisited", lessonId: "lld-strategy-hydra", activity: "proof", at: "2026-11-10T10:05:00Z" });
    reopen();
    expect((await repo.getProgress()).current).toEqual({ lessonId: "lld-strategy-hydra", activity: "proof" });
  });

  it("R3: the same event recorded twice is stored once", async () => {
    const first = await repo.recordEvent(attempt);
    const second = await repo.recordEvent(attempt);
    await repo.recordEvent(completed);
    await repo.recordEvent(completed);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(await db.attempts.count()).toBe(1);
    expect(await db.events.count()).toBe(2);
    expect((await repo.getProgress()).completedLessons).toEqual(["lld-strategy-hydra"]);
  });

  it("queues every new event once in the sync outbox", async () => {
    await repo.recordEvent(completed);
    await repo.recordEvent(completed);
    expect(await db.outbox.count()).toBe(1);
  });

  it("returns safe defaults when nothing is saved", async () => {
    const progress = await repo.getProgress();
    expect(progress.completedLessons).toEqual([]);
    expect(progress.current).toBeNull();
  });
});

describe("simulation snapshots (stage 2 foundation)", () => {
  const base = { id: "hydra#1", exerciseId: "hydra", attempt: 1, status: "unfinished" as const, schemaVersion: 2 };

  it("R4/R5: restores the exact diagram and stage after a reload", async () => {
    await repo.saveSnapshot({ ...base, state: diagram }, 0);
    reopen();
    const result = await repo.loadSnapshot("hydra", codec);
    expect(result.kind).toBe("restored");
    if (result.kind === "restored") expect(result.snapshot.state).toEqual(diagram);
  });

  it("rejects a stale write instead of overwriting newer state", async () => {
    await repo.saveSnapshot({ ...base, state: diagram }, 0);
    await repo.saveSnapshot({ ...base, state: { ...diagram, stage: "proof" } }, 1);
    await expect(repo.saveSnapshot({ ...base, state: diagram }, 1)).rejects.toBeInstanceOf(StaleWriteError);
    const result = await repo.loadSnapshot("hydra", codec);
    if (result.kind === "restored") expect(result.snapshot.state.stage).toBe("proof");
  });

  it("R6: restarting starts a new attempt and keeps the old one as history", async () => {
    await repo.saveSnapshot({ ...base, state: diagram }, 0);
    await repo.recordEvent(completed);
    const nextAttempt = await repo.restartExercise("hydra");
    expect(nextAttempt).toBe(2);
    expect((await repo.loadSnapshot("hydra", codec)).kind).toBe("none");
    expect((await db.snapshots.get("hydra#1"))?.status).toBe("abandoned");
    expect((await repo.getProgress()).completedLessons).toEqual(["lld-strategy-hydra"]);
  });

  it("R7: a failed write leaves the last valid snapshot intact", async () => {
    await repo.saveSnapshot({ ...base, state: diagram }, 0);
    const spy = vi.spyOn(db.snapshots, "put").mockRejectedValueOnce(new Error("QuotaExceededError"));
    await expect(repo.saveSnapshot({ ...base, state: { ...diagram, stage: "proof" } }, 1)).rejects.toThrow();
    spy.mockRestore();
    const result = await repo.loadSnapshot("hydra", codec);
    expect(result.kind).toBe("restored");
    if (result.kind === "restored") {
      expect(result.snapshot.state.stage).toBe("play");
      expect(result.snapshot.revision).toBe(1);
    }
  });

  it("R8: migrates a snapshot saved by an older schema version", async () => {
    await repo.saveSnapshot({ ...base, schemaVersion: 1, state: { nodes: diagram.diagram.nodes, stage: "play" } }, 0);
    const result = await repo.loadSnapshot("hydra", codec);
    expect(result.kind).toBe("restored");
    if (result.kind === "restored") expect(result.snapshot.state).toEqual(diagram);
  });

  it("quarantines a corrupted snapshot instead of deleting it", async () => {
    await repo.saveSnapshot({ ...base, state: { garbage: true } }, 0);
    const result = await repo.loadSnapshot("hydra", codec);
    expect(result.kind).toBe("unrecoverable");
    expect(await db.quarantine.count()).toBe(1);
    expect((await repo.loadSnapshot("hydra", codec)).kind).toBe("none");
  });

  it("refuses to change a completed snapshot", async () => {
    await repo.saveSnapshot({ ...base, state: diagram }, 0);
    await repo.saveSnapshot({ ...base, status: "completed", state: diagram }, 1);
    await expect(repo.saveSnapshot({ ...base, state: diagram }, 2)).rejects.toThrow(/completed/);
  });
});

describe("withRetry", () => {
  const noWait = { sleep: async () => {} };

  it("retries a transient failure and then succeeds", async () => {
    const operation = vi.fn().mockRejectedValueOnce(new Error("busy")).mockResolvedValueOnce("ok");
    await expect(withRetry(operation, noWait)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("never retries a stale write", async () => {
    const operation = vi.fn().mockRejectedValue(new StaleWriteError(3, 2));
    await expect(withRetry(operation, noWait)).rejects.toBeInstanceOf(StaleWriteError);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last attempt", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("down"));
    await expect(withRetry(operation, { ...noWait, attempts: 3 })).rejects.toThrow("down");
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
