"use client";

import { useEffect } from "react";
import { getRepository } from "@/persistence/client";

/** Records where the learner is, so the home screen can offer "Continue". */
export function RecordVisit({ lessonId, activity }: { lessonId: string; activity: string }) {
  useEffect(() => {
    const at = new Date().toISOString();
    getRepository()
      .recordEvent({ id: `visit:${lessonId}:${activity}:${at}`, type: "activityVisited", lessonId, activity, at })
      .catch(() => {
        // Visiting is not critical progress; the save status on activities reports real failures.
      });
  }, [lessonId, activity]);
  return null;
}
