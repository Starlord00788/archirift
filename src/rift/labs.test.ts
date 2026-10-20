import { describe, expect, it } from "vitest";
import {
  BLOOM_PROBES,
  BLOOM_WORDS,
  LRU_SEQUENCE,
  SAMPLE_KEYS,
  assignKeys,
  bloomBits,
  bloomFalsePositiveRate,
  bloomMightContain,
  bucketGoals,
  imbalance,
  initialLru,
  initialRace,
  lruAdvance,
  lruNext,
  movedShare,
  raceDoubleBooked,
  raceFinished,
  raceStep,
} from "./labs";

describe("consistent hashing lab", () => {
  it("modulo hashing moves most keys when a server is added", () => {
    const share = movedShare(assignKeys(SAMPLE_KEYS, 4, "modulo"), assignKeys(SAMPLE_KEYS, 5, "modulo"));
    expect(share).toBeGreaterThan(0.7);
  });

  it("a hash ring moves only about 1/n of the keys", () => {
    const share = movedShare(assignKeys(SAMPLE_KEYS, 4, "ring", 100), assignKeys(SAMPLE_KEYS, 5, "ring", 100));
    expect(share).toBeLessThan(0.3);
    expect(share).toBeGreaterThan(0.1);
  });

  it("virtual nodes even out the load, and one point per server does not", () => {
    expect(imbalance(assignKeys(SAMPLE_KEYS, 5, "ring", 1), 5)).toBeGreaterThan(1.3);
    expect(imbalance(assignKeys(SAMPLE_KEYS, 5, "ring", 100), 5)).toBeLessThan(1.3);
  });
});

describe("bloom filter lab", () => {
  it("never gives a false negative", () => {
    const bits = bloomBits(BLOOM_WORDS, 64, 3);
    for (const w of BLOOM_WORDS) expect(bloomMightContain(bits, w, 3)).toBe(true);
  });

  it("a tiny filter produces at least one false positive among the probes", () => {
    const bits = bloomBits(BLOOM_WORDS, 16, 2);
    expect(BLOOM_PROBES.some((p) => bloomMightContain(bits, p, 2))).toBe(true);
  });

  it("a larger filter drops the expected false-positive rate below 5%", () => {
    expect(bloomFalsePositiveRate(8, 16, 2)).toBeGreaterThan(0.3);
    expect(bloomFalsePositiveRate(8, 128, 3)).toBeLessThan(0.05);
  });
});

describe("token bucket lab", () => {
  it("a small bucket rejects a real person's burst", () => {
    expect(bucketGoals({ capacity: 3, refillPerSec: 3 }).personServed).toBe(false);
  });

  it("a bucket sized for the burst serves the person and blocks the scraper", () => {
    const goals = bucketGoals({ capacity: 10, refillPerSec: 4 });
    expect(goals.personServed).toBe(true);
    expect(goals.scraperBlocked).toBe(true);
  });

  it("a huge bucket lets the scraper through", () => {
    expect(bucketGoals({ capacity: 20, refillPerSec: 20 }).scraperBlocked).toBe(false);
  });
});

describe("LRU lab", () => {
  it("plays the whole sequence when the least recently used key is always evicted", () => {
    let state = initialLru();
    for (let i = 0; i < 100 && lruNext(state); i += 1) {
      const step = lruNext(state)!;
      state = lruAdvance(state, step.kind === "evict-needed" ? step.correct : undefined).state;
    }
    expect(state.position).toBe(LRU_SEQUENCE.length);
    expect(state.mistakes).toBe(0);
    expect(state.hits + state.misses).toBe(LRU_SEQUENCE.length);
  });

  it("refuses the wrong victim", () => {
    let state = initialLru();
    for (let i = 0; i < 4; i += 1) state = lruAdvance(state).state; // A B C A
    const step = lruNext(state)!; // D misses with the cache full
    expect(step.kind).toBe("evict-needed");
    const wrong = lruAdvance(state, "A");
    expect(wrong.correct).toBe(false);
    expect(wrong.state.mistakes).toBe(1);
    expect(lruAdvance(state, "B").correct).toBe(true);
  });
});

describe("race lab", () => {
  it("without a lock, interleaving the reads double-books the seat", () => {
    let s = initialRace(false);
    for (const t of [0, 1, 0, 1, 0, 1] as const) s = raceStep(s, t);
    expect(raceFinished(s)).toBe(true);
    expect(raceDoubleBooked(s)).toBe(true);
  });

  it("with a lock, no interleaving can double-book", () => {
    let s = initialRace(true);
    for (const t of [0, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1] as const) s = raceStep(s, t);
    expect(raceFinished(s)).toBe(true);
    expect(raceDoubleBooked(s)).toBe(false);
    expect(s.confirmations).toEqual(["Alice"]);
  });
});
