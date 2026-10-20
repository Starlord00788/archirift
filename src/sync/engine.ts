import type { DexieLearningRepository } from "@/persistence/repository";
import type { LearningEvent, SimulationSnapshot } from "@/persistence/types";

/**
 * The learner's cloud copy (PRD: Persistence, stage 3 "sync-ready"). Implemented with Firestore in
 * ./firestore.ts and with an in-memory fake in tests. Cursors are opaque strings chosen by the store.
 */
export interface RemoteStore {
  pushEvents(events: LearningEvent[]): Promise<void>;
  pullEvents(cursor: string | null): Promise<{ events: LearningEvent[]; cursor: string | null }>;
  pushSnapshots(snapshots: SimulationSnapshot[]): Promise<void>;
  pullSnapshots(cursor: string | null): Promise<{ snapshots: SimulationSnapshot[]; cursor: string | null }>;
}

export interface SyncReport {
  pushedEvents: number;
  pushedSnapshots: number;
  pulledEvents: number;
  pulledSnapshots: number;
}

const META = {
  eventsCursor: "sync:eventsCursor",
  snapshotsCursor: "sync:snapshotsCursor",
  snapshotsPushedUpTo: "sync:snapshotsPushedUpTo",
};

/**
 * Two-way sync between the device's IndexedDB and the cloud copy.
 * - Events are append-only with deterministic ids, so pushing or pulling twice is harmless.
 * - Snapshots carry revisions; the newer revision wins on both sides.
 * - Local data is always written first, so the app works offline and catches up later.
 */
export class SyncEngine {
  private running: Promise<SyncReport> | null = null;
  private again = false;

  constructor(
    private readonly local: DexieLearningRepository,
    private readonly remote: RemoteStore,
  ) {}

  /** Runs one sync. Calls made while a sync is running coalesce into one follow-up run. */
  sync(): Promise<SyncReport> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      let total: SyncReport = { pushedEvents: 0, pushedSnapshots: 0, pulledEvents: 0, pulledSnapshots: 0 };
      try {
        do {
          this.again = false;
          const report = await this.syncOnce();
          total = {
            pushedEvents: total.pushedEvents + report.pushedEvents,
            pushedSnapshots: total.pushedSnapshots + report.pushedSnapshots,
            pulledEvents: total.pulledEvents + report.pulledEvents,
            pulledSnapshots: total.pulledSnapshots + report.pulledSnapshots,
          };
        } while (this.again);
        return total;
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private async syncOnce(): Promise<SyncReport> {
    const { local, remote } = this;

    // 1. Push events waiting in the outbox.
    let pushedEvents = 0;
    for (;;) {
      const pending = await local.pendingEvents(400);
      if (pending.length === 0) break;
      await remote.pushEvents(pending);
      await local.markSent(pending.map((e) => e.id));
      pushedEvents += pending.length;
      if (pending.length < 400) break;
    }

    // 2. Push snapshots changed since the last push.
    const pushedUpTo = await local.getMeta(META.snapshotsPushedUpTo);
    const changed = await local.snapshotsUpdatedSince(pushedUpTo);
    if (changed.length > 0) {
      await remote.pushSnapshots(changed);
      const newest = changed.reduce((max, s) => (s.updatedAt > max ? s.updatedAt : max), pushedUpTo ?? "");
      await local.setMeta(META.snapshotsPushedUpTo, newest);
    }

    // 3. Pull events from other devices.
    let pulledEvents = 0;
    let eventsCursor = await local.getMeta(META.eventsCursor);
    for (let page = 0; page < 50; page += 1) {
      const { events, cursor } = await remote.pullEvents(eventsCursor);
      if (events.length > 0) pulledEvents += await local.importEvents(events);
      if (cursor === eventsCursor || events.length === 0) break;
      eventsCursor = cursor;
      if (cursor) await local.setMeta(META.eventsCursor, cursor);
    }

    // 4. Pull snapshots from other devices.
    let pulledSnapshots = 0;
    let snapshotsCursor = await local.getMeta(META.snapshotsCursor);
    for (let page = 0; page < 50; page += 1) {
      const { snapshots, cursor } = await remote.pullSnapshots(snapshotsCursor);
      if (snapshots.length > 0) pulledSnapshots += await local.importSnapshots(snapshots);
      if (cursor === snapshotsCursor || snapshots.length === 0) break;
      snapshotsCursor = cursor;
      if (cursor) await local.setMeta(META.snapshotsCursor, cursor);
    }

    return { pushedEvents, pushedSnapshots: changed.length, pulledEvents, pulledSnapshots };
  }
}

/** In-memory cloud copy for tests and local development. Cursors are positions in arrival order. */
export class MemoryRemoteStore implements RemoteStore {
  events = new Map<string, { event: LearningEvent; seq: number }>();
  snapshots = new Map<string, { snapshot: SimulationSnapshot; seq: number }>();
  private seq = 0;

  async pushEvents(events: LearningEvent[]) {
    for (const event of events) if (!this.events.has(event.id)) this.events.set(event.id, { event, seq: ++this.seq });
  }

  async pullEvents(cursor: string | null) {
    const after = Number(cursor ?? 0);
    const rows = [...this.events.values()].filter((r) => r.seq > after).sort((a, b) => a.seq - b.seq).slice(0, 100);
    return { events: rows.map((r) => r.event), cursor: rows.length ? String(rows.at(-1)!.seq) : cursor };
  }

  async pushSnapshots(snapshots: SimulationSnapshot[]) {
    for (const snapshot of snapshots) {
      const existing = this.snapshots.get(snapshot.id);
      // Never replace a newer revision with an older one.
      if (existing && existing.snapshot.revision > snapshot.revision) continue;
      this.snapshots.set(snapshot.id, { snapshot, seq: ++this.seq });
    }
  }

  async pullSnapshots(cursor: string | null) {
    const after = Number(cursor ?? 0);
    const rows = [...this.snapshots.values()].filter((r) => r.seq > after).sort((a, b) => a.seq - b.seq).slice(0, 100);
    return { snapshots: rows.map((r) => r.snapshot), cursor: rows.length ? String(rows.at(-1)!.seq) : cursor };
  }
}
