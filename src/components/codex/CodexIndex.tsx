"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Catalog } from "@/game/catalog";
import { useLearning } from "@/persistence/useLearning";

/** Searchable list of every cheat sheet, grouped by district. */
export function CodexIndex({ catalog, oneLiners }: { catalog: Catalog; oneLiners: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState<"all" | "lld" | "hld">("all");
  const { progress } = useLearning();
  const done = new Set(progress?.completedLessons ?? []);
  const q = query.trim().toLowerCase();

  const groups = useMemo(
    () =>
      catalog.worlds
        .filter((w) => track === "all" || w.track === track)
        .map((w) => ({
          world: w,
          levels: catalog.levels.filter(
            (l) =>
              l.world === w.id &&
              oneLiners[l.id] &&
              l.id !== "lld-strategy-hydra" &&
              (!q || `${l.conceptName} ${l.title} ${oneLiners[l.id]}`.toLowerCase().includes(q)),
          ),
        }))
        .filter((g) => g.levels.length > 0),
    [catalog, oneLiners, q, track],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex min-w-64 flex-1 items-center">
          <Icon name="search" size={16} className="absolute left-3 text-ink-quiet" />
          <span className="sr-only">Search the Codex</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: cache, singleton, sharding, CAP…"
            className="w-full rounded-2xl border border-line bg-surface/70 py-3 pl-10 pr-4 outline-none focus:border-flow"
          />
        </label>
        <div role="radiogroup" aria-label="Track" className="flex rounded-2xl border border-line p-1">
          {(["all", "lld", "hld"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={track === t} onClick={() => setTrack(t)} className={`rounded-xl px-3 py-1.5 text-sm font-medium uppercase ${track === t ? "bg-flow text-bg" : "text-ink-quiet hover:text-ink"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && <p className="text-ink-quiet">Nothing matches “{query}”.</p>}

      <AnimatePresence initial={false}>
        {groups.map(({ world, levels }) => (
          <motion.section key={world.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-labelledby={`codex-${world.id}`}>
            <h2 id={`codex-${world.id}`} className="mb-3 font-display text-xl font-semibold" style={{ color: `var(--${world.accent})` }}>
              {world.name}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {levels.map((l) => (
                <motion.li key={l.id} layout>
                  <Link href={`/codex/${l.id}/`} className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-surface/60 p-4 transition-colors hover:border-flow">
                    <span className="flex items-center justify-between gap-2 font-display font-semibold">
                      {l.conceptName}
                      {done.has(l.id) && <Icon name="check" size={15} className="text-good" label="Level completed" />}
                    </span>
                    <span className="text-sm text-ink-quiet">{oneLiners[l.id]}</span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.section>
        ))}
      </AnimatePresence>
    </div>
  );
}
