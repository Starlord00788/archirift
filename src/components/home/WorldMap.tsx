"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useCatalog } from "@/components/shell/Providers";
import { Icon } from "@/components/ui/Icon";
import { ProgressRing } from "@/components/ui/Meter";
import type { CatalogLevel, CatalogWorld } from "@/game/catalog";
import { useLearning } from "@/persistence/useLearning";

const TRACKS = [
  { id: "lld", label: "Low-level design", short: "LLD", blurb: "Classes, patterns and machine coding" },
  { id: "hld", label: "High-level design", short: "HLD", blurb: "Scaling, data and distributed systems" },
] as const;

/** The city map: two tracks, each a column of worlds with their levels as stops on a path. */
export function WorldMap() {
  const { worlds, levels } = useCatalog();
  const { progress, reviews } = useLearning();
  const [track, setTrack] = useState<"lld" | "hld">("lld");
  const done = useMemo(() => new Set(progress?.completedLessons ?? []), [progress]);
  const weak = useMemo(() => new Set(reviews.filter((r) => r.lapses > 0 && !r.lastOutcome.correct).map((r) => r.conceptId)), [reviews]);

  return (
    <section aria-labelledby="map-heading" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="map-heading" className="font-display text-3xl font-bold tracking-tight">
            The city map
          </h2>
          <p className="mt-1 text-ink-quiet">Pick any district. Levels in a district build on each other, but nothing is locked.</p>
        </div>
        <div role="tablist" aria-label="Track" className="flex rounded-2xl border border-line bg-surface/70 p-1">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={track === t.id}
              aria-controls={`track-${t.id}`}
              id={`tab-${t.id}`}
              onClick={() => setTrack(t.id)}
              className={`relative rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${track === t.id ? "text-bg" : "text-ink-quiet hover:text-ink"}`}
            >
              {track === t.id && <motion.span layoutId="track-pill" className="absolute inset-0 rounded-xl bg-gradient-to-r from-flow to-player" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">
                {t.short} <span className="hidden sm:inline">· {t.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {TRACKS.map((t) => (
        <div key={t.id} role="tabpanel" id={`track-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={track !== t.id} className="flex flex-col gap-5">
          <AnimatePresence mode="popLayout">
            {track === t.id &&
              worlds
                .filter((w) => w.track === t.id)
                .map((w, i) => (
                  <motion.div key={w.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.06, 0.4), duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
                    <WorldCard world={w} levels={levels.filter((l) => l.world === w.id)} done={done} weak={weak} />
                  </motion.div>
                ))}
          </AnimatePresence>
        </div>
      ))}
    </section>
  );
}

function WorldCard({ world, levels, done, weak }: { world: CatalogWorld; levels: CatalogLevel[]; done: Set<string>; weak: Set<string> }) {
  const finished = levels.filter((l) => done.has(l.id)).length;
  const accent = `var(--${world.accent})`;
  const nextUp = levels.find((l) => !done.has(l.id) && l.playable);
  return (
    <article className="relative overflow-hidden rounded-3xl border border-line bg-surface/70 p-5 shadow-card sm:p-6" aria-labelledby={`world-${world.id}`}>
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-[0.12] blur-3xl" style={{ background: accent }} aria-hidden="true" />
      <header className="relative flex items-start gap-4">
        <ProgressRing value={levels.length ? finished / levels.length : 0} size={54} stroke={5} tone={world.accent}>
          <span className="font-mono text-xs font-bold">
            {finished}/{levels.length}
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: accent }}>
            District {world.order} · {world.tagline}
          </p>
          <h3 id={`world-${world.id}`} className="font-display text-2xl font-bold tracking-tight">
            {world.name}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-ink-quiet">{world.description}</p>
        </div>
      </header>

      <ol className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {levels.map((level, i) => (
          <li key={level.id}>
            <LevelCard level={level} index={i} done={done.has(level.id)} weak={weak.has(level.concept)} accent={accent} next={nextUp?.id === level.id} />
          </li>
        ))}
      </ol>
    </article>
  );
}

function LevelCard({ level, index, done, weak, accent, next }: { level: CatalogLevel; index: number; done: boolean; weak: boolean; accent: string; next: boolean }) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} className="h-full">
      <Link
        href={`/levels/${level.id}/`}
        className={`group flex h-full items-start gap-3 rounded-2xl border p-3.5 transition-colors ${next ? "border-flow/60 bg-flow/5" : "border-line bg-bg/40"} hover:border-flow focus-visible:border-flow`}
      >
        <span
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold ${done ? "text-bg" : "text-ink"} ${next ? "animate-pulse-ring" : ""}`}
          style={{ background: done ? accent : "var(--surface-2)", border: `1.5px solid ${accent}` }}
          aria-hidden="true"
        >
          {done ? <Icon name="check" size={16} /> : index + 1}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-display font-semibold leading-snug group-hover:text-flow">{level.title}</span>
          {done && <span className="mt-1 w-fit rounded-full border border-good px-2 py-0.5 font-mono text-[10px] text-good">Completed</span>}
          <span className="mt-1 line-clamp-2 text-xs text-ink-quiet">{level.summary}</span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-ink-quiet">
            <span>{level.conceptName}</span>
            <span>~{level.minutes} min</span>
            <span aria-label={`Difficulty ${level.difficulty} of 3`}>{"◆".repeat(level.difficulty) + "◇".repeat(3 - level.difficulty)}</span>
            {weak && <span className="text-warn">needs review</span>}
            {next && !done && <span className="text-flow">up next</span>}
          </span>
        </span>
      </Link>
    </motion.div>
  );
}
