"use client";

import { motion } from "motion/react";
import { useId, useState } from "react";
import { useCatalog } from "@/components/shell/Providers";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatMinutes, pathFor } from "@/game/paths";
import { getRepository } from "@/persistence/client";
import type { LearningGoal } from "@/persistence/types";

const TRACKS: { id: LearningGoal["track"]; label: string; hint: string }[] = [
  { id: "lld", label: "LLD round", hint: "Classes, SOLID, patterns, machine coding" },
  { id: "hld", label: "HLD round", hint: "Scaling, databases, queues, case studies" },
  { id: "both", label: "Both", hint: "A bit of each, alternating" },
];

const HORIZONS: { id: LearningGoal["horizon"]; label: string; hint: string }[] = [
  { id: "sprint", label: "In about 2 weeks", hint: "Only what's asked most" },
  { id: "month", label: "In about a month", hint: "The core, plus the next layer" },
  { id: "open", label: "No date yet", hint: "The whole track, in order" },
];

/**
 * Two questions, one plan: what you're preparing for and when. The plan is a list of existing
 * levels (src/game/paths.ts); its size and time are shown live, before you commit to it.
 */
export function PlanPicker({ initial, onDone, compact = false }: { initial?: Pick<LearningGoal, "track" | "horizon"> | null; onDone?: () => void; compact?: boolean }) {
  const catalog = useCatalog();
  const [track, setTrack] = useState<LearningGoal["track"] | null>(initial?.track ?? null);
  const [horizon, setHorizon] = useState<LearningGoal["horizon"] | null>(initial?.horizon ?? null);
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");
  const id = useId();

  const preview = track && horizon ? pathFor({ track, horizon }, catalog) : null;
  const minutes = preview ? preview.reduce((sum, l) => sum + (catalog.levels.find((x) => x.id === l)?.minutes ?? 0), 0) : 0;

  const save = async () => {
    if (!track || !horizon) return;
    setState("saving");
    const at = new Date().toISOString();
    try {
      await getRepository().recordEvent({ id: `goal:${at}`, type: "goalSet", track, horizon, at });
      setState("idle");
      onDone?.();
    } catch {
      setState("failed");
    }
  };

  const group = (label: string, name: string, options: { id: string; label: string; hint: string }[], value: string | null, set: (v: never) => void) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-quiet">{label}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const on = value === o.id;
          return (
            <label
              key={o.id}
              className={`relative flex cursor-pointer flex-col gap-0.5 rounded-xl border px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-flow ${on ? "border-flow bg-flow/10" : "border-line bg-surface/60 hover:border-line-strong"}`}
            >
              <input type="radio" name={`${id}-${name}`} value={o.id} checked={on} onChange={() => set(o.id as never)} className="sr-only" />
              <span className="flex items-center justify-between font-semibold">
                {o.label}
                {on && <Icon name="check" size={15} className="text-flow" />}
              </span>
              <span className="text-xs text-ink-quiet">{o.hint}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <div className="flex flex-col gap-5">
      {group("What are you preparing for?", "track", TRACKS, track, setTrack as (v: never) => void)}
      {group("When is it?", "horizon", HORIZONS, horizon, setHorizon as (v: never) => void)}
      <div className={`flex flex-wrap items-center gap-4 ${compact ? "" : "pt-1"}`}>
        <Button variant="primary" disabled={!preview || state === "saving"} onClick={() => void save()}>
          {initial ? "Update my plan" : "Make my plan"} <Icon name="arrowRight" size={15} />
        </Button>
        <p aria-live="polite" className="text-sm text-ink-quiet">
          {preview ? (
            <motion.span key={`${track}-${horizon}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <strong className="text-ink">{preview.length} levels</strong>, about {formatMinutes(minutes)} in total
              {horizon !== "open" ? `, roughly ${Math.ceil(preview.length / (horizon === "sprint" ? 14 : 30))} a day` : ""}.
            </motion.span>
          ) : (
            "Pick one of each to see your plan."
          )}
        </p>
        {state === "failed" && <p className="text-sm text-fail">Your plan couldn&apos;t be saved on this device.</p>}
      </div>
    </div>
  );
}
