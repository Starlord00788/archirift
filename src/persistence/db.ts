import Dexie, { type EntityTable } from "dexie";
import type {
  Attempt,
  LearningEvent,
  OutboxEntry,
  Progress,
  QuarantinedSnapshot,
  SimulationSnapshot,
} from "./types";

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

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      events: "id, type, at",
      progress: "id",
      attempts: "id, itemId, at",
      snapshots: "id, exerciseId, status, updatedAt",
      quarantine: "++key, exerciseId",
      outbox: "eventId, queuedAt",
    });
  }
}
