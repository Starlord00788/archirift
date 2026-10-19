import { describe, expect, it } from "vitest";
import {
  createMemoryScheduler,
  gradeFromOutcome,
  isConfidentError,
  Rating,
  type ReviewOutcome,
} from "./scheduler";

const right: ReviewOutcome = { correct: true, usedHint: false, confidence: "sure", seconds: 40 };
const DAY = 24 * 60 * 60 * 1000;

describe("gradeFromOutcome", () => {
  it("rates a wrong answer Again", () => {
    expect(gradeFromOutcome({ ...right, correct: false })).toBe(Rating.Again);
  });
  it("rates a right answer with a hint Hard", () => {
    expect(gradeFromOutcome({ ...right, usedHint: true })).toBe(Rating.Hard);
  });
  it("rates a right but unsure answer Hard", () => {
    expect(gradeFromOutcome({ ...right, confidence: "unsure" })).toBe(Rating.Hard);
  });
  it("rates a right, sure answer Good", () => {
    expect(gradeFromOutcome(right)).toBe(Rating.Good);
  });
  it("rates a right, sure, fast answer Easy", () => {
    expect(gradeFromOutcome({ ...right, seconds: 8 })).toBe(Rating.Easy);
  });
});

describe("isConfidentError", () => {
  it("flags a sure but wrong answer", () => {
    expect(isConfidentError({ ...right, correct: false })).toBe(true);
    expect(isConfidentError({ ...right, correct: false, confidence: "guessing" })).toBe(false);
  });
});

describe("createMemoryScheduler", () => {
  const start = new Date("2026-11-01T09:00:00Z");

  function dueAfterTwoReviews(targetRetention: number): number {
    const scheduler = createMemoryScheduler({ targetRetention });
    const first = scheduler.review(scheduler.newCard(start), right, start);
    const secondAt = new Date(first.card.due.getTime());
    const second = scheduler.review(first.card, right, secondAt);
    return second.card.due.getTime() - secondAt.getTime();
  }

  it("schedules a card into the future and records a review log", () => {
    const scheduler = createMemoryScheduler();
    const { card, log, grade } = scheduler.review(scheduler.newCard(start), right, start);
    expect(card.due.getTime()).toBeGreaterThan(start.getTime());
    expect(log.rating).toBe(grade);
  });

  it("brings a forgotten card back sooner than a remembered one", () => {
    const scheduler = createMemoryScheduler();
    const remembered = scheduler.review(scheduler.newCard(start), right, start).card;
    const forgotten = scheduler.review(scheduler.newCard(start), { ...right, correct: false }, start).card;
    expect(forgotten.due.getTime()).toBeLessThan(remembered.due.getTime());
  });

  it("uses shorter intervals when target retention is higher", () => {
    expect(dueAfterTwoReviews(0.95)).toBeLessThan(dueAfterTwoReviews(0.8));
  });

  it("rejects a target retention outside 0.80 to 0.95", () => {
    expect(() => createMemoryScheduler({ targetRetention: 0.5 })).toThrow(RangeError);
  });

  it("never schedules beyond the maximum interval", () => {
    const scheduler = createMemoryScheduler({ maximumIntervalDays: 30 });
    let card = scheduler.newCard(start);
    let now = start;
    for (let i = 0; i < 12; i += 1) {
      card = scheduler.review(card, { ...right, seconds: 5 }, now).card;
      expect(card.due.getTime() - now.getTime()).toBeLessThanOrEqual(30 * DAY + 1000);
      now = card.due;
    }
  });
});
