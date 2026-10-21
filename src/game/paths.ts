import type { Catalog, CatalogLevel } from "./catalog";
import type { LearningGoal, Progress } from "@/persistence/types";

/**
 * Learning paths: which of the existing levels to play for a goal, so nobody has to face all 97.
 * Sprints and month plans are hand-picked: the concepts and machine-coding problems interviewers
 * ask about most, with their prerequisites. "No deadline" is the whole track in course order.
 * Every id is checked against the content in paths.test.ts.
 */
const LLD_SPRINT = [
  "lld-composition",
  "lld-uml-relationships",
  "lld-srp",
  "lld-ocp",
  "lld-dip",
  "lld-singleton",
  "lld-factory-method",
  "lld-builder",
  "lld-decorator",
  "lld-strategy-hydra",
  "lld-observer",
  "lld-state",
  "lld-race-conditions",
  "lld-interview-approach",
  "lld-parking-lot",
  "lld-lru-cache",
  "lld-splitwise",
  "lld-bookmyshow",
];

const LLD_MONTH_EXTRA = [
  "lld-polymorphism",
  "lld-lsp",
  "lld-isp",
  "lld-dependency-injection",
  "lld-abstract-factory",
  "lld-adapter",
  "lld-facade",
  "lld-proxy",
  "lld-composite",
  "lld-command",
  "lld-template-method",
  "lld-chain-of-responsibility",
  "lld-threads-executors",
  "lld-locks",
  "lld-deadlock",
  "lld-producer-consumer",
  "lld-database-schema",
  "lld-tic-tac-toe",
  "lld-elevator",
  "lld-vending-machine",
  "lld-logging-framework",
  "lld-atm",
];

const HLD_SPRINT = [
  "hld-request-journey",
  "hld-horizontal-scaling",
  "hld-load-balancing",
  "hld-caching",
  "hld-estimation",
  "hld-sql-nosql",
  "hld-indexing",
  "hld-replication",
  "hld-sharding",
  "hld-consistent-hashing",
  "hld-cap",
  "hld-message-queue",
  "hld-rate-limiting",
  "hld-interview-framework",
  "hld-design-url-shortener",
  "hld-design-chat",
  "hld-design-news-feed",
];

const HLD_MONTH_EXTRA = [
  "hld-cdn",
  "hld-consistency-models",
  "hld-pubsub-kafka",
  "hld-realtime",
  "hld-idempotency",
  "hld-circuit-breaker",
  "hld-microservices",
  "hld-api-design",
  "hld-design-notifications",
  "hld-design-video-streaming",
  "hld-design-ride-hailing",
  "hld-design-typeahead",
  "hld-design-payments",
];

/** Two rounds in two weeks: the core of each, nothing more. */
const BOTH_SPRINT_LLD = ["lld-composition", "lld-srp", "lld-ocp", "lld-singleton", "lld-factory-method", "lld-decorator", "lld-strategy-hydra", "lld-observer", "lld-interview-approach", "lld-parking-lot", "lld-lru-cache"];
const BOTH_SPRINT_HLD = ["hld-horizontal-scaling", "hld-load-balancing", "hld-caching", "hld-estimation", "hld-sql-nosql", "hld-sharding", "hld-cap", "hld-message-queue", "hld-interview-framework", "hld-design-url-shortener", "hld-design-chat"];

export const HORIZON_DAYS: Record<LearningGoal["horizon"], number | null> = { sprint: 14, month: 30, open: null };

export const TRACK_LABEL: Record<LearningGoal["track"], string> = { lld: "LLD round", hld: "HLD round", both: "LLD + HLD rounds" };
export const HORIZON_LABEL: Record<LearningGoal["horizon"], string> = { sprint: "in about 2 weeks", month: "in about a month", open: "no deadline" };

/** Puts ids in course order (world, then level), which keeps prerequisites first. */
function inCourseOrder(ids: string[], catalog: Catalog): string[] {
  const rank = new Map(catalog.levels.map((l, i) => [l.id, i]));
  return [...new Set(ids)].filter((id) => rank.has(id)).sort((a, b) => rank.get(a)! - rank.get(b)!);
}

/** Alternates between two lists, so both rounds move forward together. */
function interleave(a: string[], b: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/** The ordered level ids for a goal. */
export function pathFor(goal: Pick<LearningGoal, "track" | "horizon">, catalog: Catalog): string[] {
  const trackOf = new Map(catalog.worlds.map((w) => [w.id, w.track]));
  const whole = (track: "lld" | "hld") => catalog.levels.filter((l) => trackOf.get(l.world) === track).map((l) => l.id);
  const lld =
    goal.horizon === "sprint" ? (goal.track === "both" ? BOTH_SPRINT_LLD : LLD_SPRINT) : goal.horizon === "month" ? (goal.track === "both" ? LLD_SPRINT : [...LLD_SPRINT, ...LLD_MONTH_EXTRA]) : whole("lld");
  const hld =
    goal.horizon === "sprint" ? (goal.track === "both" ? BOTH_SPRINT_HLD : HLD_SPRINT) : goal.horizon === "month" ? (goal.track === "both" ? HLD_SPRINT : [...HLD_SPRINT, ...HLD_MONTH_EXTRA]) : whole("hld");
  if (goal.track === "lld") return inCourseOrder(lld, catalog);
  if (goal.track === "hld") return inCourseOrder(hld, catalog);
  return interleave(inCourseOrder(lld, catalog), inCourseOrder(hld, catalog));
}

export interface PlanStatus {
  goal: LearningGoal;
  levels: CatalogLevel[];
  done: CatalogLevel[];
  skipped: CatalogLevel[];
  remaining: CatalogLevel[];
  minutesLeft: number;
  next: CatalogLevel | null;
  /** Whole days left before the goal date, or null for no deadline. 0 once it has passed. */
  daysLeft: number | null;
  /** Levels a day needed to finish on time, or null when there is no deadline or nothing left. */
  perDay: number | null;
}

/** Where the learner stands on their plan, from saved progress only. */
export function planStatus(progress: Progress, catalog: Catalog, now = new Date()): PlanStatus | null {
  const goal = progress.goal;
  if (!goal) return null;
  const byId = new Map(catalog.levels.map((l) => [l.id, l]));
  const levels = pathFor(goal, catalog).map((id) => byId.get(id)!).filter(Boolean);
  const sealed = new Set(progress.completedLessons);
  const tested = new Set(progress.testedOut ?? []);
  const done = levels.filter((l) => sealed.has(l.id));
  const skipped = levels.filter((l) => !sealed.has(l.id) && tested.has(l.id));
  const remaining = levels.filter((l) => !sealed.has(l.id) && !tested.has(l.id));
  const span = HORIZON_DAYS[goal.horizon];
  const elapsed = Math.floor((now.getTime() - Date.parse(goal.setAt)) / 86_400_000);
  const daysLeft = span === null ? null : Math.max(0, span - elapsed);
  return {
    goal,
    levels,
    done,
    skipped,
    remaining,
    minutesLeft: remaining.reduce((sum, l) => sum + l.minutes, 0),
    next: remaining[0] ?? null,
    daysLeft,
    perDay: daysLeft && remaining.length ? Math.ceil(remaining.length / daysLeft) : null,
  };
}

/** "2 h 10 min", "45 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
