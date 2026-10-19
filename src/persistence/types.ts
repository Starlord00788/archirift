/**
 * Persisted data model (PRD: Persistence and resume).
 * Learning history is an append-only event log; progress is derived from it in the same transaction.
 */

/** The single local profile until accounts exist (v1.5). Sync will scope records by the signed-in user. */
export const LOCAL_PROFILE_ID = "local";

interface EventBase {
  /** Stable, deterministic id. Writing an event whose id already exists is a no-op (duplicate-proof). */
  id: string;
  /** ISO timestamp of when the action happened. */
  at: string;
}

export type LearningEvent =
  | (EventBase & { type: "lessonCompleted"; lessonId: string })
  | (EventBase & { type: "moduleUnlocked"; moduleId: string })
  | (EventBase & { type: "activityVisited"; lessonId: string; activity: string })
  | (EventBase & {
      type: "attemptSubmitted";
      attemptId: string;
      itemId: string;
      correct: boolean;
      score?: number;
      confidence?: "sure" | "unsure" | "guessing";
      hintsUsed: number;
      seconds: number;
    });

export interface Progress {
  id: string;
  completedLessons: string[];
  unlockedModules: string[];
  current: { lessonId: string; activity: string } | null;
  /** Bumped on every change; used to reject stale writes. */
  revision: number;
  updatedAt: string;
}

export interface Attempt {
  id: string;
  itemId: string;
  correct: boolean;
  score?: number;
  confidence?: "sure" | "unsure" | "guessing";
  hintsUsed: number;
  seconds: number;
  at: string;
}

export type SnapshotStatus = "unfinished" | "completed" | "abandoned";

/** A restorable simulation or exercise state. `state` is level-specific and validated on load. */
export interface SimulationSnapshot {
  /** `${exerciseId}#${attempt}` */
  id: string;
  exerciseId: string;
  attempt: number;
  status: SnapshotStatus;
  /** Version of the level's snapshot schema that produced `state`. */
  schemaVersion: number;
  /** Bumped on every save; a save based on an older revision is rejected. */
  revision: number;
  updatedAt: string;
  state: unknown;
}

/** Snapshots that failed validation or migration are kept here, never deleted silently. */
export interface QuarantinedSnapshot {
  key?: number;
  exerciseId: string;
  reason: string;
  snapshot: SimulationSnapshot;
  at: string;
}

/** Events waiting to be sent to the server once sync exists. */
export interface OutboxEntry {
  eventId: string;
  queuedAt: string;
}

export function emptyProgress(now: string): Progress {
  return {
    id: LOCAL_PROFILE_ID,
    completedLessons: [],
    unlockedModules: [],
    current: null,
    revision: 0,
    updatedAt: now,
  };
}
