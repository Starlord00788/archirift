import type { LearningEvent, Progress } from "./types";

/**
 * Pure reducer: applies one event to progress. Applying the same event twice must not change
 * the result (the repository also refuses duplicate event ids, so this is a second line of defence).
 */
export function applyEvent(progress: Progress, event: LearningEvent): Progress {
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
    case "attemptSubmitted":
      // Attempts live in their own store; progress itself does not change.
      return progress;
  }
}

function bump(progress: Progress, event: LearningEvent, changes: Partial<Progress>): Progress {
  return { ...progress, ...changes, revision: progress.revision + 1, updatedAt: event.at };
}
