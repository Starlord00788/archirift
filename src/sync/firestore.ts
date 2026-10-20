import {
  Timestamp,
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  writeBatch,
  type CollectionReference,
  type Firestore,
} from "firebase/firestore";
import type { LearningEvent, SimulationSnapshot } from "@/persistence/types";
import type { RemoteStore } from "./engine";

const PAGE = 300;

/**
 * The learner's cloud copy in Firestore, under users/{uid}. Documents store JSON strings, so the
 * level state never runs into Firestore's rules about nested arrays or undefined values.
 * Security rules (firestore.rules) only let a signed-in user read and write their own documents.
 */
export class FirestoreRemoteStore implements RemoteStore {
  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
  ) {}

  private events() {
    return collection(this.db, "users", this.uid, "events");
  }

  private snapshots() {
    return collection(this.db, "users", this.uid, "snapshots");
  }

  async pushEvents(events: LearningEvent[]) {
    for (let i = 0; i < events.length; i += PAGE) {
      const batch = writeBatch(this.db);
      for (const event of events.slice(i, i + PAGE)) {
        batch.set(doc(this.events(), safeId(event.id)), { json: JSON.stringify(event), at: event.at, syncedAt: serverTimestamp() });
      }
      await batch.commit();
    }
  }

  async pullEvents(cursor: string | null) {
    const { docs, next } = await pageAfter(this.events(), cursor);
    return { events: docs.map((json) => JSON.parse(json) as LearningEvent), cursor: next };
  }

  async pushSnapshots(snapshots: SimulationSnapshot[]) {
    for (const snapshot of snapshots) {
      const ref = doc(this.snapshots(), safeId(snapshot.id));
      // A transaction so a slower device can never replace a newer revision with an older one.
      await runTransaction(this.db, async (tx) => {
        const existing = await tx.get(ref);
        if (existing.exists() && (existing.data().revision as number) > snapshot.revision) return;
        tx.set(ref, { json: JSON.stringify(snapshot), revision: snapshot.revision, syncedAt: serverTimestamp() });
      });
    }
  }

  async pullSnapshots(cursor: string | null) {
    const { docs, next } = await pageAfter(this.snapshots(), cursor);
    return { snapshots: docs.map((json) => JSON.parse(json) as SimulationSnapshot), cursor: next };
  }
}

/**
 * Reads the next page in commit order. The cursor is "<seconds>.<nanos>|<doc id>" of the last document read,
 * so documents written in one batch (same server timestamp) are still paged through correctly.
 */
async function pageAfter(ref: CollectionReference, cursor: string | null) {
  const ordered = [orderBy("syncedAt"), orderBy(documentId())] as const;
  let q = query(ref, ...ordered, limit(PAGE));
  if (cursor) {
    const [time, id] = cursor.split("|");
    const [seconds, nanos] = time.split(".").map(Number);
    q = query(ref, ...ordered, startAfter(new Timestamp(seconds, nanos), id), limit(PAGE));
  }
  const page = await getDocs(q);
  const last = page.docs.at(-1);
  const at = last?.data().syncedAt as Timestamp | undefined;
  // Exact seconds and nanoseconds: rounding to milliseconds could skip or repeat documents.
  const next = last && at ? `${at.seconds}.${at.nanoseconds}|${last.id}` : cursor;
  return { docs: page.docs.map((d) => d.data().json as string), next };
}

/** Public profile used by the leaderboard. Only written when the learner opts in. */
export async function writeLeaderboardEntry(db: Firestore, uid: string, entry: { name: string; xp: number; levels: number; streak: number } | null) {
  const ref = doc(db, "leaderboard", uid);
  if (entry === null) {
    await setDoc(ref, { hidden: true, xp: 0, name: "", levels: 0, streak: 0, updatedAt: serverTimestamp() });
    return;
  }
  await setDoc(ref, { ...entry, hidden: false, updatedAt: serverTimestamp() });
}

/** Firestore document ids cannot contain "/". */
function safeId(id: string) {
  return id.replaceAll("/", "∕");
}
