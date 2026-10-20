import { ArchiriftDB, DB_NAME } from "./db";
import { DexieLearningRepository, type LearningRepository, type SnapshotCodec } from "./repository";
import type { LearningEvent, SimulationSnapshot } from "./types";

/**
 * Which learner's data this browser tab uses. Guests use the original "archirift" database; each
 * signed-in account gets its own database, so two people sharing a laptop never mix progress.
 */
const PROFILE_KEY = "archirift:profile";
export const GUEST = "guest";
export const CHANGE_EVENT = "archirift:change";

export function activeProfile(): string {
  try {
    return (typeof window !== "undefined" && window.localStorage.getItem(PROFILE_KEY)) || GUEST;
  } catch {
    return GUEST;
  }
}

export function setActiveProfile(profile: string) {
  try {
    window.localStorage.setItem(PROFILE_KEY, profile);
  } catch {
    // Storage blocked: the tab keeps using whatever it has open.
  }
}

export function dbNameFor(profile: string) {
  return profile === GUEST ? DB_NAME : `${DB_NAME}-u-${profile}`;
}

let local: DexieLearningRepository | undefined;
let repository: LearningRepository | undefined;

/** The device store for the active profile, with the extra operations sync needs. */
export function getLocalStore(): DexieLearningRepository {
  local ??= new DexieLearningRepository(new ArchiriftDB(dbNameFor(activeProfile())));
  return local;
}

/** One shared repository per browser tab. Only call from client components. */
export function getRepository(): LearningRepository {
  repository ??= new NotifyingRepository(getLocalStore());
  return repository;
}

/** Tells listeners (the header, the review badge, sync) that learning data changed. */
export function notifyLearningChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onLearningChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

/** Moves everything a guest did on this device into an account's database, then clears the guest data. */
export async function adoptGuestProgress(uid: string): Promise<number> {
  const guestDb = new ArchiriftDB(dbNameFor(GUEST));
  const guest = new DexieLearningRepository(guestDb);
  const accountDb = new ArchiriftDB(dbNameFor(uid));
  const account = new DexieLearningRepository(accountDb);
  try {
    const events = await guest.allEvents();
    const snapshots = await guest.allSnapshots();
    const adopted = await account.importEvents(events, { queueForSync: true });
    await account.importSnapshots(snapshots);
    guestDb.close();
    local?.close();
    await ArchiriftDB.delete(dbNameFor(GUEST));
    return adopted;
  } finally {
    guestDb.close();
    accountDb.close();
  }
}

/** Repository that announces every change it makes. */
class NotifyingRepository implements LearningRepository {
  constructor(private readonly inner: DexieLearningRepository) {}

  async recordEvent(event: LearningEvent) {
    const result = await this.inner.recordEvent(event);
    if (!result.duplicate) notifyLearningChange();
    return result;
  }

  getProgress() {
    return this.inner.getProgress();
  }

  async saveSnapshot(snapshot: Omit<SimulationSnapshot, "revision" | "updatedAt">, basedOnRevision: number) {
    const saved = await this.inner.saveSnapshot(snapshot, basedOnRevision);
    notifyLearningChange();
    return saved;
  }

  loadSnapshot<S>(exerciseId: string, codec: SnapshotCodec<S>) {
    return this.inner.loadSnapshot(exerciseId, codec);
  }

  async restartExercise(exerciseId: string) {
    const attempt = await this.inner.restartExercise(exerciseId);
    notifyLearningChange();
    return attempt;
  }

  getReview(conceptId: string) {
    return this.inner.getReview(conceptId);
  }

  dueReviews(now: Date) {
    return this.inner.dueReviews(now);
  }
}
