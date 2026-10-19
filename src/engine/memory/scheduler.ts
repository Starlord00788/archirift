import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type Grade,
  type ReviewLog,
} from "ts-fsrs";

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the player actually did on a review. Ratings come from performance, never self-rating. */
export interface ReviewOutcome {
  correct: boolean;
  usedHint: boolean;
  confidence: "sure" | "unsure" | "guessing";
  /** Time to answer, in seconds. */
  seconds: number;
}

export interface SchedulerOptions {
  /** Target probability of recall when a card comes due (PRD: adjustable from 0.80 to 0.95). */
  targetRetention?: number;
  maximumIntervalDays?: number;
  /** Answers at or under this many seconds count as fast. */
  fastSeconds?: number;
}

/**
 * Maps performance to an FSRS grade (PRD: Engineering memory cards, "How a card plays"):
 * wrong is Again; right with a hint or low confidence is Hard; right is Good; right, fast and sure is Easy.
 */
export function gradeFromOutcome(outcome: ReviewOutcome, fastSeconds = 20): Grade {
  if (!outcome.correct) return Rating.Again;
  if (outcome.usedHint || outcome.confidence !== "sure") return Rating.Hard;
  if (outcome.seconds <= fastSeconds) return Rating.Easy;
  return Rating.Good;
}

/** A confident wrong answer goes to the Mistake Log. */
export function isConfidentError(outcome: ReviewOutcome): boolean {
  return !outcome.correct && outcome.confidence === "sure";
}

export function createMemoryScheduler(options: SchedulerOptions = {}) {
  const targetRetention = options.targetRetention ?? 0.9;
  if (targetRetention < 0.8 || targetRetention > 0.95) {
    throw new RangeError("targetRetention must be between 0.80 and 0.95");
  }
  const maximumIntervalDays = options.maximumIntervalDays ?? 365;
  const engine = fsrs(
    generatorParameters({
      request_retention: targetRetention,
      maximum_interval: maximumIntervalDays,
      enable_fuzz: false,
    }),
  );

  return {
    newCard(now: Date): Card {
      return createEmptyCard(now);
    },
    review(card: Card, outcome: ReviewOutcome, now: Date): { card: Card; log: ReviewLog; grade: Grade } {
      const grade = gradeFromOutcome(outcome, options.fastSeconds);
      const { card: next, log } = engine.next(card, now, grade);
      // ts-fsrs keeps Easy intervals longer than Good ones, which can push them a day or two past
      // maximum_interval. The player's setting is a hard cap, so clamp it here.
      const latest = now.getTime() + maximumIntervalDays * DAY_MS;
      if (next.due.getTime() > latest) {
        return { card: { ...next, due: new Date(latest), scheduled_days: maximumIntervalDays }, log, grade };
      }
      return { card: next, log, grade };
    },
  };
}

export { Rating };
