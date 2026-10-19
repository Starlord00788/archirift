import Dexie, { type EntityTable } from "dexie";
import type {
  Attempt,
  LearningEvent,
  OutboxEntry,
  Progress,
  QuarantinedSnapshot,
  ReviewRecord,
  SimulationSnapshot,
} from "./types";

/** Version 1 of the schema, kept so migration tests can create a database exactly as v1 users have it. */
export const SCHEMA_V1 = {
  events: "id, type, at",
  progress: "id",
  attempts: "id, itemId, at",
  snapshots: "id, exerciseId, status, updatedAt",
  quarantine: "++key, exerciseId",
  outbox: "eventId, queuedAt",
};

export const DB_NAME = "archirift";

/**
 * IndexedDB schema. Every schema change adds a new `version(n)` with an upgrade step and a
 * migration test that opens a database from version n-1 (PRD acceptance test R8).
 */
export class ArchiriftDB extends Dexie {
  events!: EntityTable<LearningEvent, "id">;
  progress!: EntityTable<Progress, "id">;
  attempts!: EntityTable<Attempt, "id">;
  snapshots!: EntityTable<SimulationSnapshot, "id">;
  quarantine!: EntityTable<QuarantinedSnapshot, "key">;
  outbox!: EntityTable<OutboxEntry, "eventId">;
  reviews!: EntityTable<ReviewRecord, "conceptId">;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    // v2 (Milestone 1): review schedules get their own store; progress gains achievements.
    this.version(2)
      .stores({ reviews: "conceptId, due" })
      .upgrade(async (tx) => {
        await tx
          .table("progress")
          .toCollection()
          .modify((progress: Partial<Progress>) => {
            progress.achievements ??= [];
          });
      });
  }
}
