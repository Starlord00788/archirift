"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRepository } from "@/persistence/client";
import type { Progress } from "@/persistence/types";

interface Props {
  levels: { id: string; title: string }[];
}

/** Offers "Continue" from the last saved activity (PRD: Persistence and resume, "What the learner sees"). */
export function ContinueCard({ levels }: Props) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getRepository()
      .getProgress()
      .then(setProgress)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <p role="status" className="rounded-lg border border-warn p-4 text-sm">
        Progress can&apos;t be saved on this device (storage may be blocked, for example in private browsing).
      </p>
    );
  }

  const current = progress?.current;
  const level = current ? levels.find((l) => l.id === current.lessonId) : undefined;
  if (!current || !level) return null;

  return (
    <Link
      href={`/levels/${level.id}/`}
      className="rounded-lg border border-flow bg-surface p-4 focus-visible:outline-none"
    >
      <span className="font-mono text-xs text-flow">Continue</span>
      <span className="mt-1 block font-display text-lg font-semibold">
        {level.title}, {current.activity} beat
      </span>
    </Link>
  );
}
