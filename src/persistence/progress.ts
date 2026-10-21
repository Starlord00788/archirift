import type { LearningEvent, Progress } from "./types";

/**
 * Only real study counts towards a streak: answering (in a level, a review, the Arena or a skip
 * test), finishing a level or earning XP. Opening a page, making a plan or reading does not.
 */
export const STUDY_EVENTS = new Set<LearningEvent["type"]>(["studied", "attemptSubmitted", "reviewGraded", "lessonCompleted", "xpEarned"]);

/** The UTC days with real study in an event log: what a streak is built from. */
export function studyDays(events: LearningEvent[]): string[] {
  return [...new Set(events.filter((e) => STUDY_EVENTS.has(e.type)).map((e) => e.at.slice(0, 10)))].sort();
}

/**
 * Pure reducer: applies one event to progress. Applying the same event twice must not change
 * the result (the repository also refuses duplicate event ids, so this is a second line of defence).
 */
export function applyEvent(progress: Progress, event: LearningEvent): Progress {
  const changed = applyChange(progress, event);
  const day = event.at.slice(0, 10);
  if (progress.activeDays.includes(day) || !STUDY_EVENTS.has(event.type)) return changed;
  const activeDays = [...changed.activeDays, day].sort();
  return changed === progress ? bump(progress, event, { activeDays }) : { ...changed, activeDays };
}

function applyChange(progress: Progress, event: LearningEvent): Progress {
  switch (event.type) {
    case "lessonCompleted":
      if (progress.completedLessons.includes(event.lessonId)) return progress;
      return bump(progress, event, { completedLessons: [...progress.completedLessons, event.lessonId] });
    case "moduleUnlocked":
      if (progress.unlockedModules.includes(event.moduleId)) return progress;
      return bump(progress, event, { unlockedModules: [...progress.unlockedModules, event.moduleId] });
    case "activityVisited": {
      const same =
        progress.current?.lessonId === event.lessonId && progress.current?.activity === event.activity;
      if (same) return progress;
      return bump(progress, event, { current: { lessonId: event.lessonId, activity: event.activity } });
    }
    case "achievementEarned":
      if (progress.achievements.includes(event.achievementId)) return progress;
      return bump(progress, event, { achievements: [...progress.achievements, event.achievementId] });
    case "xpEarned":
      return bump(progress, event, { xp: progress.xp + event.amount });
    case "goalSet":
      return bump(progress, event, { goal: { track: event.track, horizon: event.horizon, setAt: event.at } });
    case "levelsTestedOut": {
      const known = progress.testedOut ?? [];
      const fresh = event.levelIds.filter((id) => !known.includes(id));
      return fresh.length ? bump(progress, event, { testedOut: [...known, ...fresh] }) : progress;
    }
    case "studied":
    case "attemptSubmitted":
    case "reviewGraded":
      // Attempts and review schedules live in their own stores; progress itself does not change.
      return progress;
    default:
      // An event from a newer version of the app (synced from another device): keep it, skip it.
      return progress;
  }
}

function bump(progress: Progress, event: LearningEvent, changes: Partial<Progress>): Progress {
  return { ...progress, ...changes, revision: progress.revision + 1, updatedAt: event.at };
}

/** Consecutive active days ending today or yesterday (a streak survives until a full day is missed). */
export function currentStreak(activeDays: string[], today: string): number {
  const days = new Set(activeDays);
  const step = (d: string, by: number) => new Date(Date.parse(`${d}T00:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);
  let cursor = days.has(today) ? today : step(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = step(cursor, -1);
  }
  return streak;
}
