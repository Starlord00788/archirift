import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { ArchiriftDB } from "@/persistence/db";
import { currentStreak } from "@/persistence/progress";
import { DexieLearningRepository } from "@/persistence/repository";
import type { LearningEvent } from "@/persistence/types";
import { MemoryRemoteStore, SyncEngine, type RemoteStore } from "./engine";

const opened: ArchiriftDB[] = [];
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await ArchiriftDB.delete(db.name);
  }
});

function device(remote: RemoteStore, clock = () => new Date("2026-11-10T10:00:00Z")) {
  const db = new ArchiriftDB(`sync-${Math.random()}`);
  opened.push(db);
  const repo = new DexieLearningRepository(db, clock);
  return { db, repo, sync: new SyncEngine(repo, remote) };
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
const ev = (id: string, at: string, rest: DistributiveOmit<LearningEvent, "id" | "at">) => ({ id, at, ...rest }) as LearningEvent;

describe("cloud sync", () => {
  it("S1: progress made on one device appears on another after both sync", async () => {
    const cloud = new MemoryRemoteStore();
    const laptop = device(cloud);
    const phone = device(cloud);

    await laptop.repo.recordEvent(ev("lessonCompleted:lld-singleton", "2026-11-10T09:00:00Z", { type: "lessonCompleted", lessonId: "lld-singleton" }));
    await laptop.repo.recordEvent(ev("xp:level:lld-singleton", "2026-11-10T09:00:01Z", { type: "xpEarned", amount: 180, reason: "lld-singleton" }));
    await laptop.sync.sync();
    const report = await phone.sync.sync();

    expect(report.pulledEvents).toBe(2);
    const progress = await phone.repo.getProgress();
    expect(progress.completedLessons).toEqual(["lld-singleton"]);
    expect(progress.xp).toBe(180);
    // Pulled events are not sent back.
    expect(await phone.repo.pendingEvents()).toEqual([]);
  });

  it("S2: syncing twice changes nothing and never duplicates events", async () => {
    const cloud = new MemoryRemoteStore();
    const a = device(cloud);
    await a.repo.recordEvent(ev("xp:1", "2026-11-10T09:00:00Z", { type: "xpEarned", amount: 50, reason: "x" }));
    await a.sync.sync();
    const second = await a.sync.sync();
    expect(second).toEqual({ pushedEvents: 0, pushedSnapshots: 0, pulledEvents: 0, pulledSnapshots: 0 });
    expect(cloud.events.size).toBe(1);
    expect((await a.repo.getProgress()).xp).toBe(50);
  });

  it("S3: review schedules converge even when devices graded in a different order", async () => {
    const cloud = new MemoryRemoteStore();
    const a = device(cloud);
    const b = device(cloud);
    const outcome = (correct: boolean) => ({ correct, usedHint: false, confidence: "sure" as const, seconds: 10 });
    await a.repo.recordEvent(ev("review:1", "2026-11-01T10:00:00Z", { type: "reviewGraded", conceptId: "singleton", outcome: outcome(true) }));
    await b.repo.recordEvent(ev("review:2", "2026-11-05T10:00:00Z", { type: "reviewGraded", conceptId: "singleton", outcome: outcome(false) }));
    await a.sync.sync();
    await b.sync.sync();
    await a.sync.sync();

    const ra = await a.repo.getReview("singleton");
    const rb = await b.repo.getReview("singleton");
    expect(ra?.reviews).toBe(2);
    expect(ra?.lapses).toBe(1);
    expect(ra?.due.toISOString()).toBe(rb?.due.toISOString());
  });

  it("S4: an unfinished level continues on another device, and an older copy never overwrites a newer one", async () => {
    const cloud = new MemoryRemoteStore();
    const a = device(cloud);
    const b = device(cloud);
    const base = { id: "lvl#1", exerciseId: "lvl", attempt: 1, status: "unfinished" as const, schemaVersion: 1 };
    await a.repo.saveSnapshot({ ...base, state: { step: 1 } }, 0);
    await a.sync.sync();
    await b.sync.sync();
    const codec = { currentVersion: 1, migrate: (s: unknown) => s as { step: number } };
    const onB = await b.repo.loadSnapshot("lvl", codec);
    expect(onB.kind === "restored" && onB.snapshot.state).toEqual({ step: 1 });

    // B moves on twice; A's stale copy is pushed again later and must not win.
    await b.repo.saveSnapshot({ ...base, state: { step: 2 } }, 1);
    await b.repo.saveSnapshot({ ...base, state: { step: 3 } }, 2);
    await b.sync.sync();
    await a.sync.sync();
    await cloud.pushSnapshots([{ ...base, state: { step: 1 }, revision: 1, updatedAt: "2026-11-10T10:00:00Z" }]);
    await b.sync.sync();
    const onA = await a.repo.loadSnapshot("lvl", codec);
    const stillB = await b.repo.loadSnapshot("lvl", codec);
    expect(onA.kind === "restored" && onA.snapshot.state).toEqual({ step: 3 });
    expect(stillB.kind === "restored" && stillB.snapshot.state).toEqual({ step: 3 });
  });

  it("S5: when the network fails, events stay queued and go out on the next sync", async () => {
    const cloud = new MemoryRemoteStore();
    let online = false;
    const flaky: RemoteStore = {
      pushEvents: (e) => (online ? cloud.pushEvents(e) : Promise.reject(new Error("offline"))),
      pullEvents: (c) => cloud.pullEvents(c),
      pushSnapshots: (s) => cloud.pushSnapshots(s),
      pullSnapshots: (c) => cloud.pullSnapshots(c),
    };
    const a = device(flaky);
    await a.repo.recordEvent(ev("xp:offline", "2026-11-10T09:00:00Z", { type: "xpEarned", amount: 10, reason: "x" }));
    await expect(a.sync.sync()).rejects.toThrow("offline");
    expect((await a.repo.pendingEvents()).map((e) => e.id)).toEqual(["xp:offline"]);
    online = true;
    await a.sync.sync();
    expect(await a.repo.pendingEvents()).toEqual([]);
    expect(cloud.events.has("xp:offline")).toBe(true);
  });

  it("guest progress adopted into an account is queued for upload", async () => {
    const cloud = new MemoryRemoteStore();
    const account = device(cloud);
    await account.repo.importEvents([ev("lessonCompleted:a", "2026-11-09T10:00:00Z", { type: "lessonCompleted", lessonId: "a" })], { queueForSync: true });
    await account.sync.sync();
    expect(cloud.events.has("lessonCompleted:a")).toBe(true);
  });
});

describe("gamified progress", () => {
  it("adds XP and records each active day once", async () => {
    const a = device(new MemoryRemoteStore());
    await a.repo.recordEvent(ev("xp:a", "2026-11-08T10:00:00Z", { type: "xpEarned", amount: 100, reason: "a" }));
    await a.repo.recordEvent(ev("xp:b", "2026-11-08T12:00:00Z", { type: "xpEarned", amount: 40, reason: "b" }));
    await a.repo.recordEvent(ev("xp:c", "2026-11-09T12:00:00Z", { type: "xpEarned", amount: 10, reason: "c" }));
    const p = await a.repo.getProgress();
    expect(p.xp).toBe(150);
    expect(p.activeDays).toEqual(["2026-11-08", "2026-11-09"]);
  });

  it("doesn't count merely opening a level as an active day", async () => {
    const a = device(new MemoryRemoteStore());
    await a.repo.recordEvent(ev("visit:a", "2026-11-08T10:00:00Z", { type: "activityVisited", lessonId: "a", activity: "pain" }));
    expect((await a.repo.getProgress()).activeDays).toEqual([]);
    await a.repo.recordEvent(ev("review:a", "2026-11-08T11:00:00Z", { type: "reviewGraded", conceptId: "a", outcome: { correct: true, usedHint: false, confidence: "sure", seconds: 5 } }));
    expect((await a.repo.getProgress()).activeDays).toEqual(["2026-11-08"]);
  });

  it("counts a streak through today or yesterday", () => {
    expect(currentStreak(["2026-11-08", "2026-11-09", "2026-11-10"], "2026-11-10")).toBe(3);
    expect(currentStreak(["2026-11-08", "2026-11-09"], "2026-11-10")).toBe(2);
    expect(currentStreak(["2026-11-07", "2026-11-08"], "2026-11-10")).toBe(0);
    expect(currentStreak([], "2026-11-10")).toBe(0);
  });
});
