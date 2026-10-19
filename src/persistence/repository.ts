import { ArchiriftDB } from "./db";
import { applyEvent } from "./progress";
import {
  LOCAL_PROFILE_ID,
  emptyProgress,
  type LearningEvent,
  type Progress,
  type SimulationSnapshot,
} from "./types";

/** Thrown when a save is based on an older revision than the one stored (never stale over new). */
export class StaleWriteError extends Error {
  constructor(
    readonly storedRevision: number,
    readonly attemptedFrom: number,
  ) {
    super(`Stale write: stored revision ${storedRevision}, write based on ${attemptedFrom}`);
    this.name = "StaleWriteError";
  }
}

/**
 * Validates and, if needed, migrates a stored snapshot's state to the level's current schema.
 * Return `null` when the state cannot be used; the snapshot is then quarantined, not deleted.
 */
export interface SnapshotCodec<S> {
  currentVersion: number;
  migrate(state: unknown, fromVersion: number): S | null;
}

export type LoadResult<S> =
  | { kind: "none" }
  | { kind: "restored"; snapshot: SimulationSnapshot & { state: S } }
  | { kind: "unrecoverable"; reason: string };

/**
 * The only way the app reads or writes learning data. Lessons, the memory engine and simulations
 * depend on this interface, so storage can change (e.g. cloud sync in v1.5) without touching them.
 */
export interface LearningRepository {
  recordEvent(event: LearningEvent): Promise<{ duplicate: boolean; progress: Progress }>;
  getProgress(): Promise<Progress>;
  saveSnapshot(
    snapshot: Omit<SimulationSnapshot, "revision" | "updatedAt">,
    basedOnRevision: number,
  ): Promise<SimulationSnapshot>;
  loadSnapshot<S>(exerciseId: string, codec: SnapshotCodec<S>): Promise<LoadResult<S>>;
  restartExercise(exerciseId: string): Promise<number>;
}

export class DexieLearningRepository implements LearningRepository {
  constructor(
    private readonly db = new ArchiriftDB(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async recordEvent(event: LearningEvent) {
    const { db } = this;
    return db.transaction("rw", [db.events, db.progress, db.attempts, db.outbox], async () => {
      const current = (await db.progress.get(LOCAL_PROFILE_ID)) ?? emptyProgress(event.at);
      if (await db.events.get(event.id)) return { duplicate: true, progress: current };

      await db.events.add(event);
      await db.outbox.add({ eventId: event.id, queuedAt: this.now().toISOString() });
      if (event.type === "attemptSubmitted") {
        await db.attempts.add({
          id: event.attemptId,
          itemId: event.itemId,
          correct: event.correct,
          score: event.score,
          confidence: event.confidence,
          hintsUsed: event.hintsUsed,
          seconds: event.seconds,
          at: event.at,
        });
      }
      const next = applyEvent(current, event);
      if (next !== current || !(await db.progress.get(LOCAL_PROFILE_ID))) await db.progress.put(next);
      return { duplicate: false, progress: next };
    });
  }

  async getProgress() {
    return (await this.db.progress.get(LOCAL_PROFILE_ID)) ?? emptyProgress(this.now().toISOString());
  }

  async saveSnapshot(snapshot: Omit<SimulationSnapshot, "revision" | "updatedAt">, basedOnRevision: number) {
    const { db } = this;
    return db.transaction("rw", db.snapshots, async () => {
      const stored = await db.snapshots.get(snapshot.id);
      const storedRevision = stored?.revision ?? 0;
      if (storedRevision !== basedOnRevision) throw new StaleWriteError(storedRevision, basedOnRevision);
      if (stored && stored.status !== "unfinished") {
        throw new Error(`Snapshot ${snapshot.id} is ${stored.status} and can no longer change`);
      }
      const saved: SimulationSnapshot = {
        ...snapshot,
        revision: storedRevision + 1,
        updatedAt: this.now().toISOString(),
      };
      // `put` replaces the old record only if the transaction commits, so a failed write
      // leaves the previous snapshot intact (PRD acceptance test R7).
      await db.snapshots.put(saved);
      return saved;
    });
  }

  async loadSnapshot<S>(exerciseId: string, codec: SnapshotCodec<S>): Promise<LoadResult<S>> {
    const { db } = this;
    const latest = await this.latestUnfinished(exerciseId);
    if (!latest) return { kind: "none" };

    let state: S | null = null;
    let reason = "";
    try {
      state = codec.migrate(latest.state, latest.schemaVersion);
      if (state === null) reason = `state from schema v${latest.schemaVersion} failed validation`;
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
    if (state !== null) {
      return { kind: "restored", snapshot: { ...latest, schemaVersion: codec.currentVersion, state } };
    }

    // Keep the broken copy for export or later repair, and close it so a fresh attempt can start.
    await db.transaction("rw", [db.snapshots, db.quarantine], async () => {
      await db.quarantine.add({ exerciseId, reason, snapshot: latest, at: this.now().toISOString() });
      await db.snapshots.put({ ...latest, status: "abandoned" });
    });
    return { kind: "unrecoverable", reason };
  }

  /** Starts a fresh attempt. Earlier attempts stay in the database as history. */
  async restartExercise(exerciseId: string) {
    const { db } = this;
    return db.transaction("rw", db.snapshots, async () => {
      const all = await db.snapshots.where("exerciseId").equals(exerciseId).toArray();
      for (const snapshot of all.filter((s) => s.status === "unfinished")) {
        await db.snapshots.put({ ...snapshot, status: "abandoned" });
      }
      return all.reduce((max, s) => Math.max(max, s.attempt), 0) + 1;
    });
  }

  private async latestUnfinished(exerciseId: string) {
    const all = await this.db.snapshots.where("exerciseId").equals(exerciseId).toArray();
    return all
      .filter((s) => s.status === "unfinished")
      .sort((a, b) => b.attempt - a.attempt)[0];
  }
}
