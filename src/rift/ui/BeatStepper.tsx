"use client";

import { motion } from "motion/react";
import type { RiftBeat } from "../state";

const BEATS: { id: RiftBeat; label: string }[] = [
  { id: "pain", label: "Pain" },
  { id: "play", label: "Play" },
  { id: "proof", label: "Proof" },
  { id: "recall", label: "Recall" },
];

/** The four beats of every level, with a glowing line that fills as you go. */
export function BeatStepper({ current, playProgress = 0 }: { current: RiftBeat; playProgress?: number }) {
  const index = current === "reward" ? BEATS.length : BEATS.findIndex((b) => b.id === current);
  const fill = Math.min(1, (index + (current === "play" ? playProgress : 0)) / (BEATS.length - 1));
  return (
    <ol className="relative flex items-center justify-between gap-2" aria-label="Level progress">
      <span className="absolute left-3 right-3 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line" aria-hidden="true" />
      <motion.span
        className="absolute left-3 right-3 top-[calc(50%-1px)] h-0.5 rounded-full bg-linear-to-r from-flow to-player"
        style={{ originX: 0 }}
        initial={false}
        animate={{ scaleX: fill }}
        transition={{ type: "spring", stiffness: 90, damping: 20 }}
        aria-hidden="true"
      />
      {BEATS.map((b, i) => {
        const state = i < index ? "done" : i === index ? "current" : "todo";
        return (
          <li key={b.id} aria-current={state === "current" ? "step" : undefined} className="relative z-10 flex flex-col items-center">
            <span
              className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                state === "current" ? "border-flow bg-flow text-bg shadow-glow" : state === "done" ? "border-flow/60 bg-surface text-flow" : "border-line bg-surface text-ink-quiet"
              }`}
            >
              {b.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
