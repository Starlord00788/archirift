"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CityScape } from "@/components/fx/CityScape";
import { TiltCard } from "@/components/fx/TiltCard";
import { useCatalog } from "@/components/shell/Providers";
import { Icon } from "@/components/ui/Icon";
import { ProgressRing } from "@/components/ui/Meter";
import type { CatalogLevel, CatalogWorld } from "@/game/catalog";
import { useLearning } from "@/persistence/useLearning";

const TRACKS = [
  { id: "lld", label: "Low-level design", short: "LLD" },
  { id: "hld", label: "High-level design", short: "HLD" },
] as const;

const MORPH = { type: "spring", stiffness: 300, damping: 30 } as const;

/**
 * The city map: one calm tile per district. Opening a tile morphs it (shared layoutId) into a
 * full-screen card listing that district's levels, so the page stays simple until you choose.
 */
export function WorldMap() {
  const { worlds, levels } = useCatalog();
  const { progress, reviews } = useLearning();
  const [track, setTrack] = useState<"lld" | "hld">("lld");
  const [open, setOpen] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const done = useMemo(() => new Set(progress?.completedLessons ?? []), [progress]);
  const weak = useMemo(() => new Set(reviews.filter((r) => r.lapses > 0 && !r.lastOutcome.correct).map((r) => r.conceptId)), [reviews]);
  const opener = useRef<HTMLButtonElement | null>(null);

  const show = useCallback(
    (id: string | null) => {
      setOpen(id);
      const url = new URL(window.location.href);
      url.hash = id ? `world-${id}` : "";
      window.history.replaceState(null, "", id ? url : url.pathname + url.search);
    },
    [setOpen],
  );

  // Deep links (/#world-data) and the browser's back button bring a district straight back.
  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.match(/^#world-(.+)$/)?.[1];
      const world = worlds.find((w) => w.id === id);
      if (world) {
        setTrack(world.track);
        setOpen(world.id);
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [worlds]);

  const openWorld = worlds.find((w) => w.id === open);

  return (
    <section aria-labelledby="map-heading" className="flex scroll-mt-24 flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-flow">The city map</p>
          <h2 id="map-heading" className="mt-2 font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
            Pick a district.
          </h2>
          <p className="mt-2 max-w-md text-ink-quiet">Each one is a short path of levels. Start anywhere; nothing is locked.</p>
        </div>
        <div role="tablist" aria-label="Track" className="flex rounded-full border border-line bg-surface/70 p-1">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={track === t.id}
              aria-controls={`track-${t.id}`}
              id={`tab-${t.id}`}
              onClick={() => setTrack(t.id)}
              className={`relative rounded-full px-5 py-2 text-sm font-semibold transition-colors ${track === t.id ? "text-bg" : "text-ink-quiet hover:text-ink"}`}
            >
              {track === t.id && <motion.span layoutId="track-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">
                {t.short} <span className="hidden sm:inline">· {t.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* The skyline: your progress as a city. Decorative; the tiles below are the accessible path. */}
      <div className="relative -mx-4 h-[240px] sm:mx-0 sm:h-[340px] lg:h-[400px]">
        <CityScape
          worlds={worlds}
          levels={levels}
          done={done}
          track={track}
          focus={focus}
          onFocus={setFocus}
          onPick={(id) => {
            opener.current = document.querySelector<HTMLButtonElement>(`[data-world="${id}"]`);
            show(id);
          }}
        />
        <p className="pointer-events-none absolute bottom-2 right-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-quiet sm:right-0">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-lamp" aria-hidden="true" /> Built
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] border border-ink-quiet" aria-hidden="true" /> Blueprint
          </span>
        </p>
      </div>

      {TRACKS.map((t) => (
        <div key={t.id} role="tabpanel" id={`track-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={track !== t.id}>
          {track === t.id && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {worlds
                .filter((w) => w.track === t.id)
                .map((w, i) => {
                  const own = levels.filter((l) => l.world === w.id);
                  return (
                    <motion.li key={w.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...MORPH, delay: Math.min(i * 0.05, 0.35) }}>
                      <WorldTile
                        world={w}
                        total={own.length}
                        finished={own.filter((l) => done.has(l.id)).length}
                        hidden={open === w.id}
                        lit={focus === w.id}
                        onFocusChange={(on) => setFocus(on ? w.id : null)}
                        onOpen={(el) => {
                          opener.current = el;
                          show(w.id);
                        }}
                      />
                    </motion.li>
                  );
                })}
            </ul>
          )}
        </div>
      ))}

      <AnimatePresence>
        {openWorld && (
          <WorldOverlay
            key={openWorld.id}
            world={openWorld}
            levels={levels.filter((l) => l.world === openWorld.id)}
            done={done}
            weak={weak}
            onClose={() => {
              show(null);
              requestAnimationFrame(() => opener.current?.focus());
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function WorldTile({
  world,
  total,
  finished,
  hidden,
  lit,
  onFocusChange,
  onOpen,
}: {
  world: CatalogWorld;
  total: number;
  finished: number;
  hidden: boolean;
  lit: boolean;
  onFocusChange: (on: boolean) => void;
  onOpen: (el: HTMLButtonElement) => void;
}) {
  const accent = `var(--${world.accent})`;
  return (
    <TiltCard className="rounded-3xl">
      <motion.button
        layoutId={hidden ? undefined : `world-${world.id}`}
        transition={MORPH}
        onClick={(e) => onOpen(e.currentTarget)}
        onPointerEnter={() => onFocusChange(true)}
        onPointerLeave={() => onFocusChange(false)}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
        data-world={world.id}
        aria-haspopup="dialog"
        style={{ visibility: hidden ? "hidden" : "visible" }}
        className={`group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border bg-surface/70 p-6 text-left shadow-card transition-colors hover:border-line-strong ${lit ? "border-line-strong" : "border-line"}`}
      >
        <span aria-hidden="true" className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-40 ${lit ? "opacity-40" : "opacity-20"}`} style={{ background: accent }} />
        <span className="relative flex items-start justify-between gap-4">
          <motion.span layoutId={hidden ? undefined : `world-tag-${world.id}`} transition={MORPH} className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: accent }}>
            District {String(world.order).padStart(2, "0")}
          </motion.span>
          <ProgressRing value={total ? finished / total : 0} size={44} stroke={4} tone={world.accent}>
            <span className="font-mono text-[10px] font-bold">
              {finished}/{total}
            </span>
          </ProgressRing>
        </span>
        <motion.span layoutId={hidden ? undefined : `world-name-${world.id}`} transition={MORPH} className="relative mt-6 block font-display text-2xl font-bold tracking-tight">
          {world.name}
        </motion.span>
        <span className="relative mt-1 text-sm text-ink-quiet">{world.tagline}</span>
        <span className="relative mt-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-quiet transition-colors group-hover:text-ink">
          {total} levels
          <Icon name="arrowRight" size={13} className="transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </motion.button>
    </TiltCard>
  );
}

function WorldOverlay({ world, levels, done, weak, onClose }: { world: CatalogWorld; levels: CatalogLevel[]; done: Set<string>; weak: Set<string>; onClose: () => void }) {
  const accent = `var(--${world.accent})`;
  const close = useRef<HTMLButtonElement>(null);
  const finished = levels.filter((l) => done.has(l.id)).length;
  const nextUp = levels.find((l) => !done.has(l.id) && l.playable);

  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  // Rendered into <body> so no animated ancestor can trap it under the header.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div aria-hidden="true" className="absolute inset-0 bg-bg/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        layoutId={`world-${world.id}`}
        transition={MORPH}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`overlay-${world.id}`}
        className="relative flex max-h-[92svh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-line-strong bg-surface shadow-card sm:rounded-3xl"
      >
        <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: accent }} />
        <header className="relative flex items-start gap-4 border-b border-line p-6">
          <div className="min-w-0 flex-1">
            <motion.p layoutId={`world-tag-${world.id}`} transition={MORPH} className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: accent }}>
              District {String(world.order).padStart(2, "0")}
            </motion.p>
            <motion.h3 layoutId={`world-name-${world.id}`} transition={MORPH} id={`overlay-${world.id}`} className="mt-2 font-display text-3xl font-bold tracking-tight">
              {world.name}
            </motion.h3>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.15 } }} exit={{ opacity: 0 }} className="mt-2 max-w-2xl text-sm text-ink-quiet">
              {world.description}
            </motion.p>
          </div>
          <ProgressRing value={levels.length ? finished / levels.length : 0} size={52} stroke={5} tone={world.accent}>
            <span className="font-mono text-xs font-bold">
              {finished}/{levels.length}
            </span>
          </ProgressRing>
          <button ref={close} onClick={onClose} aria-label="Close" className="rounded-full border border-line p-2 text-ink-quiet transition-colors hover:border-flow hover:text-ink">
            <Icon name="x" size={18} />
          </button>
        </header>
        <motion.ol
          className="relative grid gap-3 overflow-y-auto p-6 sm:grid-cols-2"
          initial="hidden"
          animate="shown"
          exit="hidden"
          variants={{ hidden: { opacity: 0 }, shown: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.12 } } }}
        >
          {levels.map((level, i) => (
            <motion.li key={level.id} variants={{ hidden: { opacity: 0, y: 14 }, shown: { opacity: 1, y: 0, transition: MORPH } }}>
              <LevelCard level={level} index={i} done={done.has(level.id)} weak={weak.has(level.concept)} accent={accent} next={nextUp?.id === level.id} />
            </motion.li>
          ))}
        </motion.ol>
      </motion.div>
    </div>,
    document.body,
  );
}

function LevelCard({ level, index, done, weak, accent, next }: { level: CatalogLevel; index: number; done: boolean; weak: boolean; accent: string; next: boolean }) {
  return (
    <Link
      href={`/levels/${level.id}/`}
      className={`group flex h-full items-start gap-3 rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 ${next ? "border-flow/60 bg-flow/5" : "border-line bg-bg/40"} hover:border-flow focus-visible:border-flow`}
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
          <span>~{level.minutes} min</span>
          <span role="img" aria-label={`Difficulty ${level.difficulty} of 3`}>{"◆".repeat(level.difficulty) + "◇".repeat(3 - level.difficulty)}</span>
          {weak && <span className="text-warn">needs review</span>}
          {next && !done && <span className="text-flow">up next</span>}
        </span>
      </span>
    </Link>
  );
}
