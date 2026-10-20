"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useCatalog } from "@/components/shell/Providers";
import { Counter } from "@/components/ui/Counter";
import { Icon } from "@/components/ui/Icon";
import { Meter } from "@/components/ui/Meter";
import { rankFor } from "@/game/ranks";
import { currentStreak } from "@/persistence/progress";
import { useLearning } from "@/persistence/useLearning";

/** Continue, today's reviews, streak and rank: the dashboard strip under the hero. */
export function TodayPanel() {
  const { progress, due, failed } = useLearning();
  const { levels } = useCatalog();

  if (failed) {
    return (
      <p role="status" className="rounded-2xl border border-warn p-4 text-sm">
        Progress can&apos;t be saved on this device (storage may be blocked, for example in private browsing).
      </p>
    );
  }

  const current = progress?.current;
  // A finished level is not something to "continue"; offer the next one instead.
  const continueLevel = current && !progress?.completedLessons.includes(current.lessonId) ? levels.find((l) => l.id === current.lessonId) : undefined;
  const xp = progress?.xp ?? 0;
  const { rank, next, progress: rankProgress, toNext } = rankFor(xp);
  const streak = progress ? currentStreak(progress.activeDays, new Date().toISOString().slice(0, 10)) : 0;
  const firstLevel = levels.find((l) => l.playable && !progress?.completedLessons.includes(l.id));

  const card = "flex flex-col gap-2 rounded-2xl border border-line bg-surface/70 p-4 shadow-card";
  return (
    <section aria-label="Today" className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
      {current && continueLevel ? (
        <motion.div whileHover={{ y: -2 }}>
          <Link href={`/levels/${continueLevel.id}/`} className={`${card} h-full border-flow/70 bg-gradient-to-br from-flow/10 to-player/10 hover:border-flow`}>
            <span className="flex items-center gap-2 font-mono text-xs text-flow">
              <Icon name="play" size={13} filled /> Continue
            </span>
            <span className="font-display text-lg font-semibold">
              {continueLevel.title}, {current.activity} beat
            </span>
            <span className="text-xs text-ink-quiet">Pick up exactly where you left off.</span>
          </Link>
        </motion.div>
      ) : (
        <motion.div whileHover={{ y: -2 }}>
          <Link href={firstLevel ? `/levels/${firstLevel.id}/` : "/"} className={`${card} h-full border-flow/70 bg-gradient-to-br from-flow/10 to-player/10 hover:border-flow`}>
            <span className="flex items-center gap-2 font-mono text-xs text-flow">
              <Icon name="sparkles" size={13} /> Start here
            </span>
            <span className="font-display text-lg font-semibold">{firstLevel?.title ?? "Pick a level"}</span>
            <span className="text-xs text-ink-quiet">Ten minutes. One concept you&apos;ll never forget.</span>
          </Link>
        </motion.div>
      )}

      <Link href="/review/" className={`${card} hover:border-pink`}>
        <span className="flex items-center gap-2 font-mono text-xs text-pink">
          <Icon name="brain" size={13} /> Memory
        </span>
        <span className="font-display text-2xl font-bold">
          <Counter value={due.length} /> <span className="text-sm font-medium text-ink-quiet">due today</span>
        </span>
        <span className="text-xs text-ink-quiet">{due.length > 0 ? "Recall them now; that's what makes them stick." : "Nothing due. Your memory is in shape."}</span>
      </Link>

      <Link href="/profile/" className={`${card} hover:border-warn`}>
        <span className="flex items-center gap-2 font-mono text-xs text-warn">
          <Icon name="flame" size={13} filled={streak > 0} /> Streak
        </span>
        <span className="font-display text-2xl font-bold">
          <Counter value={streak} /> <span className="text-sm font-medium text-ink-quiet">{streak === 1 ? "day" : "days"}</span>
        </span>
        <span className="text-xs text-ink-quiet">{streak > 0 ? "Come back tomorrow to keep it alive." : "Finish a level or a review to start one."}</span>
      </Link>

      <Link href="/profile/" className={`${card} hover:border-flow`}>
        <span className="flex items-center gap-2 font-mono text-xs text-flow">
          <Icon name="bolt" size={13} filled /> {rank.name}
        </span>
        <span className="font-display text-2xl font-bold">
          <Counter value={xp} /> <span className="text-sm font-medium text-ink-quiet">XP</span>
        </span>
        <Meter value={rankProgress} label="Progress to the next rank" height={6} />
        <span className="text-xs text-ink-quiet">{next ? `${toNext} XP to ${next.name}` : "Top rank reached."}</span>
      </Link>
    </section>
  );
}
