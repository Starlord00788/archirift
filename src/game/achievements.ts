import { currentStreak } from "@/persistence/progress";
import type { Progress } from "@/persistence/types";
import type { Catalog } from "./catalog";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** A short glyph shown on the badge. */
  glyph: string;
  tone: "flow" | "player" | "warn" | "good" | "pink" | "lime";
}

export interface AchievementContext {
  progress: Progress;
  catalog: Catalog;
  reviewsDone: number;
  today: string;
}

interface Rule extends Achievement {
  earned(ctx: AchievementContext): boolean;
}

const completed = (ctx: AchievementContext) => new Set(ctx.progress.completedLessons);
const trackDone = (ctx: AchievementContext, track: "lld" | "hld") => {
  const done = completed(ctx);
  const worlds = new Set(ctx.catalog.worlds.filter((w) => w.track === track).map((w) => w.id));
  const levels = ctx.catalog.levels.filter((l) => worlds.has(l.world));
  return levels.length > 0 && levels.every((l) => done.has(l.id));
};

function rules(catalog: Catalog): Rule[] {
  const base: Rule[] = [
    { id: "first-rift", name: "First Rift Sealed", description: "Finish your first level.", glyph: "1", tone: "flow", earned: (c) => c.progress.completedLessons.length >= 1 },
    { id: "five-rifts", name: "Rift Walker", description: "Finish five levels.", glyph: "5", tone: "player", earned: (c) => c.progress.completedLessons.length >= 5 },
    { id: "twenty-rifts", name: "City Engineer", description: "Finish twenty levels.", glyph: "20", tone: "pink", earned: (c) => c.progress.completedLessons.length >= 20 },
    { id: "hydra-slayer", name: "Hydra Slayer", description: "Defeat the If-Else Hydra.", glyph: "H", tone: "warn", earned: (c) => c.progress.completedLessons.includes("lld-strategy-hydra") },
    { id: "flawless", name: "Flawless", description: "Finish a level with no missteps and no hints.", glyph: "★", tone: "lime", earned: (c) => c.progress.achievements.includes("flawless") },
    { id: "streak-3", name: "Warming Up", description: "Learn three days in a row.", glyph: "3d", tone: "warn", earned: (c) => currentStreak(c.progress.activeDays, c.today) >= 3 || c.progress.achievements.includes("streak-3") },
    { id: "streak-7", name: "On Fire", description: "Learn seven days in a row.", glyph: "7d", tone: "warn", earned: (c) => currentStreak(c.progress.activeDays, c.today) >= 7 || c.progress.achievements.includes("streak-7") },
    { id: "streak-30", name: "Unstoppable", description: "Learn thirty days in a row.", glyph: "30", tone: "pink", earned: (c) => currentStreak(c.progress.activeDays, c.today) >= 30 || c.progress.achievements.includes("streak-30") },
    { id: "memory-keeper", name: "Memory Keeper", description: "Answer ten spaced reviews.", glyph: "M", tone: "good", earned: (c) => c.reviewsDone >= 10 },
    { id: "arena-champion", name: "Arena Champion", description: "Score 8 or more in a Boss Rush.", glyph: "⚔", tone: "pink", earned: (c) => c.progress.achievements.includes("arena-champion") },
    { id: "lld-master", name: "LLD Master", description: "Finish every low-level design level.", glyph: "L", tone: "flow", earned: (c) => trackDone(c, "lld") },
    { id: "hld-master", name: "HLD Master", description: "Finish every high-level design level.", glyph: "H", tone: "player", earned: (c) => trackDone(c, "hld") },
  ];
  const worlds: Rule[] = catalog.worlds.map((w) => ({
    id: `world:${w.id}`,
    name: `${w.name} Champion`,
    description: `Finish every level in ${w.name}.`,
    glyph: w.name[0],
    tone: w.accent,
    earned: (c) => {
      const levels = c.catalog.levels.filter((l) => l.world === w.id);
      const done = completed(c);
      return levels.length > 0 && levels.every((l) => done.has(l.id));
    },
  }));
  return [...base, ...worlds];
}

export function allAchievements(catalog: Catalog): Achievement[] {
  return rules(catalog).map(({ id, name, description, glyph, tone }) => ({ id, name, description, glyph, tone }));
}

/** Achievements whose rule is met now but that have not been recorded yet. */
export function newlyEarned(ctx: AchievementContext): Achievement[] {
  const have = new Set(ctx.progress.achievements);
  return rules(ctx.catalog)
    .filter((r) => !have.has(r.id) && r.earned(ctx))
    .map(({ id, name, description, glyph, tone }) => ({ id, name, description, glyph, tone }));
}
