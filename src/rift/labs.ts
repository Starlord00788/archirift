/**
 * Pure logic for the interactive labs. The widgets in src/rift/ui/labs only draw these models,
 * so every lab can be tested without a browser.
 */

// ---------------- Hashing ----------------

/** 32-bit FNV-1a: fast, deterministic and good enough to place keys on a ring. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Final avalanche so similar strings land far apart.
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0x5bd1e995);
  hash ^= hash >>> 15;
  return hash >>> 0;
}

export const RING_SIZE = 2 ** 32;

// ---------------- Consistent hashing lab ----------------

export type HashMode = "modulo" | "ring";

export interface RingPoint {
  server: number;
  position: number;
}

export function ringPoints(servers: number, vnodes: number): RingPoint[] {
  const points: RingPoint[] = [];
  for (let s = 0; s < servers; s += 1) {
    for (let v = 0; v < vnodes; v += 1) points.push({ server: s, position: fnv1a(`server-${s}#${v}`) });
  }
  return points.sort((a, b) => a.position - b.position);
}

/** Which server owns each key: `hash % n`, or the first ring point clockwise from the key. */
export function assignKeys(keys: string[], servers: number, mode: HashMode, vnodes = 1): number[] {
  if (mode === "modulo") return keys.map((k) => fnv1a(k) % servers);
  const points = ringPoints(servers, vnodes);
  return keys.map((k) => {
    const h = fnv1a(k);
    let lo = 0;
    let hi = points.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid].position < h) lo = mid + 1;
      else hi = mid;
    }
    return points[lo % points.length].server;
  });
}

export function movedShare(before: number[], after: number[]): number {
  const moved = before.filter((owner, i) => owner !== after[i]).length;
  return before.length === 0 ? 0 : moved / before.length;
}

/** Busiest server's load divided by the average load (1 is perfectly even). */
export function imbalance(owners: number[], servers: number): number {
  const loads = new Array<number>(servers).fill(0);
  for (const o of owners) loads[o] += 1;
  return Math.max(...loads) / (owners.length / servers);
}

export const SAMPLE_KEYS = Array.from({ length: 2000 }, (_, i) => `user:${i * 7919 + 13}`);

// ---------------- Bloom filter lab ----------------

export function bloomPositions(word: string, bits: number, hashes: number): number[] {
  // Double hashing (Kirsch–Mitzenmacher): h1 + i·h2 gives k independent-enough positions.
  const h1 = fnv1a(word);
  const h2 = (fnv1a(`${word}#salt`) | 1) >>> 0;
  return Array.from({ length: hashes }, (_, i) => (h1 + i * h2) % bits);
}

export function bloomBits(words: string[], bits: number, hashes: number): boolean[] {
  const set = new Array<boolean>(bits).fill(false);
  for (const w of words) for (const p of bloomPositions(w, bits, hashes)) set[p] = true;
  return set;
}

export function bloomMightContain(bitsSet: boolean[], word: string, hashes: number): boolean {
  return bloomPositions(word, bitsSet.length, hashes).every((p) => bitsSet[p]);
}

/** Expected false-positive rate after n insertions: (1 − e^(−kn/m))^k. */
export function bloomFalsePositiveRate(n: number, bits: number, hashes: number): number {
  return (1 - Math.exp((-hashes * n) / bits)) ** hashes;
}

export const BLOOM_WORDS = ["arjun", "meera", "kabir", "zoya", "dev", "isha", "rohan", "tara"];
export const BLOOM_PROBES = ["neel", "asha", "vikram", "lina", "omar", "pia", "sam", "uma", "yash", "noor"];

// ---------------- Token bucket lab ----------------

export interface BucketSettings {
  capacity: number;
  refillPerSec: number;
}

export interface TraceResult {
  accepted: number;
  total: number;
  /** For drawing: one entry per second, [accepted, rejected]. */
  perSecond: [number, number][];
}

/** Request times in seconds for each client over a 10-second window. */
export const TRACES = {
  // A real person: opens the app (a burst of 8 calls), then 2 calls a second.
  person: [...Array.from({ length: 8 }, () => 0), ...Array.from({ length: 18 }, (_, i) => 1 + i * 0.5)],
  // A scraper hammering the API at 30 requests a second.
  scraper: Array.from({ length: 300 }, (_, i) => i / 30),
};

export function runBucket(settings: BucketSettings, times: number[]): TraceResult {
  let tokens = settings.capacity;
  let last = 0;
  let accepted = 0;
  const perSecond: [number, number][] = Array.from({ length: 10 }, () => [0, 0]);
  for (const t of times) {
    tokens = Math.min(settings.capacity, tokens + (t - last) * settings.refillPerSec);
    last = t;
    const second = Math.min(9, Math.floor(t));
    if (tokens >= 1) {
      tokens -= 1;
      accepted += 1;
      perSecond[second][0] += 1;
    } else {
      perSecond[second][1] += 1;
    }
  }
  return { accepted, total: times.length, perSecond };
}

export function bucketGoals(settings: BucketSettings) {
  const person = runBucket(settings, TRACES.person);
  const scraper = runBucket(settings, TRACES.scraper);
  return {
    person,
    scraper,
    personServed: person.accepted === person.total,
    scraperBlocked: 1 - scraper.accepted / scraper.total >= 0.7,
  };
}

// ---------------- LRU lab ----------------

export const LRU_CAPACITY = 3;
export const LRU_SEQUENCE = ["A", "B", "C", "A", "D", "B", "E", "A", "C", "D", "A", "B"];

export interface LruState {
  position: number;
  /** Least recently used first. */
  cache: string[];
  hits: number;
  misses: number;
  mistakes: number;
}

export const initialLru = (): LruState => ({ position: 0, cache: [], hits: 0, misses: 0, mistakes: 0 });

export type LruStep =
  | { kind: "hit" }
  | { kind: "fill" }
  | { kind: "evict-needed"; candidates: string[]; correct: string };

/** What happens at the current access, before the player acts. */
export function lruNext(state: LruState): LruStep | null {
  const key = LRU_SEQUENCE[state.position];
  if (key === undefined) return null;
  if (state.cache.includes(key)) return { kind: "hit" };
  if (state.cache.length < LRU_CAPACITY) return { kind: "fill" };
  return { kind: "evict-needed", candidates: [...state.cache].sort(), correct: state.cache[0] };
}

/** Advance one access. `evict` is required when the cache is full and the key is missing. */
export function lruAdvance(state: LruState, evict?: string): { state: LruState; correct: boolean } {
  const key = LRU_SEQUENCE[state.position];
  const step = lruNext(state);
  if (!step || key === undefined) return { state, correct: true };
  if (step.kind === "hit") {
    return { state: { ...state, position: state.position + 1, hits: state.hits + 1, cache: [...state.cache.filter((k) => k !== key), key] }, correct: true };
  }
  if (step.kind === "fill") {
    return { state: { ...state, position: state.position + 1, misses: state.misses + 1, cache: [...state.cache, key] }, correct: true };
  }
  if (evict !== step.correct) return { state: { ...state, mistakes: state.mistakes + 1 }, correct: false };
  return {
    state: { ...state, position: state.position + 1, misses: state.misses + 1, cache: [...state.cache.filter((k) => k !== evict), key] },
    correct: true,
  };
}

// ---------------- Race condition lab ----------------

export type RaceOp = "lock" | "read" | "check" | "write" | "unlock";

export interface RaceState {
  locking: boolean;
  /** Program counter of each thread. */
  pc: [number, number];
  /** What each thread read from the seat. */
  seen: [string | null | undefined, string | null | undefined];
  seat: string | null;
  holder: 0 | 1 | null;
  confirmations: string[];
  log: string[];
}

export const RACE_USERS = ["Alice", "Bob"] as const;

export const raceProgram = (locking: boolean): RaceOp[] =>
  locking ? ["lock", "read", "check", "write", "unlock"] : ["read", "check", "write"];

export const initialRace = (locking: boolean): RaceState => ({
  locking,
  pc: [0, 0],
  seen: [undefined, undefined],
  seat: null,
  holder: null,
  confirmations: [],
  log: [],
});

export function raceCanStep(state: RaceState, t: 0 | 1): boolean {
  const program = raceProgram(state.locking);
  const op = program[state.pc[t]];
  if (op === undefined) return false;
  if (op === "lock") return state.holder === null || state.holder === t;
  return true;
}

export function raceStep(state: RaceState, t: 0 | 1): RaceState {
  if (!raceCanStep(state, t)) return state;
  const user = RACE_USERS[t];
  const op = raceProgram(state.locking)[state.pc[t]];
  const pc: [number, number] = [...state.pc];
  const seen: RaceState["seen"] = [...state.seen];
  let { seat, holder } = state;
  const confirmations = [...state.confirmations];
  let line = "";
  // A thread that sees the seat taken stops after its check.
  let finished = false;
  switch (op) {
    case "lock":
      holder = t;
      line = `${user}'s thread takes the lock`;
      break;
    case "read":
      seen[t] = seat;
      line = `${user}'s thread reads seat 7: ${seat ?? "free"}`;
      break;
    case "check":
      if (seen[t] === null) line = `${user}'s thread: it was free, so go ahead`;
      else {
        line = `${user}'s thread: taken by ${seen[t]}, show "sold out"`;
        finished = true;
      }
      break;
    case "write":
      seat = user;
      confirmations.push(user);
      line = `${user}'s thread writes seat 7 = ${user} and emails a ticket`;
      break;
    case "unlock":
      holder = null;
      line = `${user}'s thread releases the lock`;
      break;
  }
  const program = raceProgram(state.locking);
  if (finished) {
    pc[t] = program.length;
    if (state.locking) holder = null;
  } else pc[t] += 1;
  return { ...state, pc, seen, seat, holder, confirmations, log: [...state.log, line] };
}

export const raceFinished = (state: RaceState) => state.pc.every((p) => p >= raceProgram(state.locking).length);
export const raceDoubleBooked = (state: RaceState) => state.confirmations.length > 1;
