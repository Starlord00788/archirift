"use client";

import { useEffect, useState } from "react";
import { getRepository } from "@/persistence/client";

/** Shows "Completed" on a level the learner has finished (PRD acceptance test R1). */
export function LevelBadge({ levelId }: { levelId: string }) {
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    getRepository()
      .getProgress()
      .then((p) => setCompleted(p.completedLessons.includes(levelId)))
      .catch(() => {});
  }, [levelId]);
  if (!completed) return null;
  return <span className="ml-2 rounded-full border border-flow px-2 py-0.5 align-middle font-mono text-xs text-flow">Completed</span>;
}
