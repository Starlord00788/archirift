"use client";

import { useCallback, useRef } from "react";
import { getRepository } from "./client";

/**
 * Marks today as a study day for a level, the first time the learner answers something in it.
 * Opening a level doesn't count; answering does, even if they stop before the end. Recorded once
 * per level per day (the event id is deterministic, so repeats are free no-ops).
 */
export function useStudyMark(lessonId: string) {
  const marked = useRef<string | null>(null);
  return useCallback(() => {
    const at = new Date().toISOString();
    const day = at.slice(0, 10);
    if (marked.current === day) return;
    marked.current = day;
    getRepository()
      .recordEvent({ id: `studied:${lessonId}:${day}`, type: "studied", lessonId, at })
      .catch(() => {
        marked.current = null;
      });
  }, [lessonId]);
}
