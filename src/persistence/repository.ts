import { createMemoryScheduler } from "@/engine/memory/scheduler";
import { ArchiriftDB } from "./db";
import { applyEvent } from "./progress";
import {
  LOCAL_PROFILE_ID,
  emptyProgress,
  normaliseProgress,
  type LearningEvent,
  type Progress,
  type ReviewRecord,
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
  getReview(conceptId: string): Promise<ReviewRecord | undefined>;
  dueReviews(now: Date): Promise<ReviewRecord[]>;
}

export class DexieLearningRepository implements LearningRepository {
  constructor(
    private readonly db = new ArchiriftDB(),
    private readonly now: () => Date = () => new Date(),
    private readonly scheduler = createMemoryScheduler(),
  ) {}

  async recordEvent(event: LearningEvent) {
    const { db } = this;
    return db.transaction("rw", [db.events, db.progress, db.attempts, db.outbox, db.reviews], async () => {
      const stored = await db.progress.get(LOCAL_PROFILE_ID);
      const current = stored ? normaliseProgress(stored) : emptyProgress(event.at);
      if (await db.events.get(event.id)) return { duplicate: true, progress: current };

      await db.events.add(event);
      await db.outbox.add({ eventId: event.id, queuedAt: this.now().toISOString() });
      const next = await this.deriveFrom(current, event);
      if (next !== current || !stored) await db.progress.put(next);
      return { duplicate: false, progress: next };
    });
  }

  /**
   * Updates every store derived from one event (attempts, review schedules, progress). Runs inside
   * the caller's transaction, so the log and what is derived from it can never disagree.
   */
  private async deriveFrom(current: Progress, event: LearningEvent): Promise<Progress> {
    const { db } = this;
    if (event.type === "attemptSubmitted") {
      await db.attempts.put({
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
    if (event.type === "reviewGraded") {
      const at = new Date(event.at);
      const existing = await db.reviews.get(event.conceptId);
      const { card } = this.scheduler.review(existing?.card ?? this.scheduler.newCard(at), event.outcome, at);
      await db.reviews.put({
        conceptId: event.conceptId,
        card,
        due: card.due,
        reviews: (existing?.reviews ?? 0) + 1,
        lapses: (existing?.lapses ?? 0) + (event.outcome.correct ? 0 : 1),
        lastOutcome: event.outcome,
        updatedAt: event.at,
      });
    }
    return applyEvent(current, event);
  }

  // ---------------- Sync support (used by src/sync) ----------------

  /** Events not yet sent to the learner's cloud copy, oldest first. */
  async pendingEvents(limit = 400): Promise<LearningEvent[]> {
    const entries = await this.db.outbox.orderBy("queuedAt").limit(limit).toArray();
    const events = await this.db.events.bulkGet(entries.map((e) => e.eventId));
    return events.filter((e): e is LearningEvent => Boolean(e));
  }

  async markSent(eventIds: string[]) {
    await this.db.outbox.bulkDelete(eventIds);
  }

  /**
   * Adds events that came from another device. Already-known ids are skipped. Because events can
   * arrive out of order, everything derived from the log is rebuilt by replaying it in time order.
   */
  async importEvents(events: LearningEvent[], options: { queueForSync?: boolean } = {}): Promise<number> {
    const { db } = this;
    return db.transaction("rw", [db.events, db.progress, db.attempts, db.outbox, db.reviews], async () => {
      const known = new Set((await db.events.bulkGet(events.map((e) => e.id))).filter(Boolean).map((e) => e!.id));
      const fresh = events.filter((e) => !known.has(e.id));
      if (fresh.length === 0) return 0;
      await db.events.bulkAdd(fresh);
      if (options.queueForSync) {
        const queuedAt = this.now().toISOString();
        await db.outbox.bulkPut(fresh.map((e) => ({ eventId: e.id, queuedAt })));
      }
      await this.rebuildDerived();
      return fresh.length;
    });
  }

  /** Replays the whole event log. Must run inside a transaction over the derived stores. */
  private async rebuildDerived() {
    const { db } = this;
    const all = (await db.events.toArray()).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    const previous = await db.progress.get(LOCAL_PROFILE_ID);
    await db.reviews.clear();
    await db.attempts.clear();
    let progress = emptyProgress(all[0]?.at ?? this.now().toISOString());
    for (const event of all) progress = await this.deriveFrom(progress, event);
    // Revisions only ever grow, so stale-write checks keep working after a rebuild.
    progress = { ...progress, revision: Math.max(progress.revision, (previous?.revision ?? 0) + 1) };
    await db.progress.put(progress);
  }

  async allEvents(): Promise<LearningEvent[]> {
    return this.db.events.toArray();
  }

  async allSnapshots(): Promise<SimulationSnapshot[]> {
    return this.db.snapshots.toArray();
  }

  async snapshotsUpdatedSince(iso: string | null): Promise<SimulationSnapshot[]> {
    if (!iso) return this.db.snapshots.toArray();
    return this.db.snapshots.where("updatedAt").above(iso).toArray();
  }

  /**
   * Stores snapshots from another device when they are newer. Higher revision wins; on a tie a
   * finished attempt beats an unfinished one. Returns how many were stored.
   */
  async importSnapshots(snapshots: SimulationSnapshot[]): Promise<number> {
    const { db } = this;
    const rank = (s: SimulationSnapshot) => (s.status === "unfinished" ? 0 : 1);
    return db.transaction("rw", db.snapshots, async () => {
      let stored = 0;
      for (const remote of snapshots) {
        const local = await db.snapshots.get(remote.id);
        const newer = !local || remote.revision > local.revision || (remote.revision === local.revision && rank(remote) > rank(local));
        if (newer) {
          await db.snapshots.put(remote);
          stored += 1;
        }
      }
      return stored;
    });
  }

  async allReviews(): Promise<ReviewRecord[]> {
    return this.db.reviews.toArray();
  }

  async recentAttempts(limit = 200) {
    return this.db.attempts.orderBy("at").reverse().limit(limit).toArray();
  }

  close() {
    this.db.close();
  }

  async getMeta(key: string): Promise<string | null> {
    return (await this.db.meta.get(key))?.value ?? null;
  }

  async setMeta(key: string, value: string) {
    await this.db.meta.put({ key, value });
  }

  async getProgress() {
    const stored = await this.db.progress.get(LOCAL_PROFILE_ID);
    return stored ? normaliseProgress(stored) : emptyProgress(this.now().toISOString());
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
      await db.snapshots.put({ ...latest, status: "abandoned", revision: latest.revision + 1, updatedAt: this.now().toISOString() });
    });
    return { kind: "unrecoverable", reason };
  }

  /** Starts a fresh attempt. Earlier attempts stay in the database as history. */
  async restartExercise(exerciseId: string) {
    const { db } = this;
    return db.transaction("rw", db.snapshots, async () => {
      const all = await db.snapshots.where("exerciseId").equals(exerciseId).toArray();
      for (const snapshot of all.filter((s) => s.status === "unfinished")) {
        // A new revision and timestamp so the change reaches the learner's other devices.
        await db.snapshots.put({ ...snapshot, status: "abandoned", revision: snapshot.revision + 1, updatedAt: this.now().toISOString() });
      }
      return all.reduce((max, s) => Math.max(max, s.attempt), 0) + 1;
    });
  }

  async getReview(conceptId: string) {
    return this.db.reviews.get(conceptId);
  }

  async dueReviews(now: Date) {
    return this.db.reviews.where("due").belowOrEqual(now).toArray();
  }

  private async latestUnfinished(exerciseId: string) {
    const all = await this.db.snapshots.where("exerciseId").equals(exerciseId).toArray();
    return all
      .filter((s) => s.status === "unfinished")
      .sort((a, b) => b.attempt - a.attempt)[0];
  }
}
