"use client";

import { useSyncExternalStore } from "react";
import { getLocalStore, onLearningChange } from "./client";
import type { Progress, ReviewRecord } from "./types";

export interface LearningSnapshot {
  progress: Progress | null;
  reviews: ReviewRecord[];
  due: ReviewRecord[];
  failed: boolean;
}

const EMPTY: LearningSnapshot = { progress: null, reviews: [], due: [], failed: false };

/**
 * One shared, live view of the learner's progress and review schedule for the whole tab. The
 * header, the dashboard and the achievement watcher all read it, but the database is read once
 * per change.
 */
let snapshot: LearningSnapshot = EMPTY;
const listeners = new Set<() => void>();
let started = false;
let loading: Promise<void> | null = null;
let again = false;

async function load() {
  if (loading) {
    again = true;
    return loading;
  }
  loading = (async () => {
    do {
      again = false;
      try {
        const store = getLocalStore();
        const [progress, reviews] = await Promise.all([store.getProgress(), store.allReviews()]);
        const now = Date.now();
        snapshot = { progress, reviews, due: reviews.filter((r) => new Date(r.due).getTime() <= now), failed: false };
      } catch {
        snapshot = { ...snapshot, failed: true };
      }
      for (const l of listeners) l();
    } while (again);
  })();
  try {
    await loading;
  } finally {
    loading = null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    void load();
    onLearningChange(() => void load());
    // Reviews come due while the page is open.
    setInterval(() => void load(), 5 * 60_000);
  }
  return () => listeners.delete(listener);
}

export function useLearning(): LearningSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}
