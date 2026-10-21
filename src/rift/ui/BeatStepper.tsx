"use client";

import { motion } from "motion/react";
import type { RiftBeat } from "../state";

const BEATS: { id: RiftBeat; label: string; plain: string }[] = [
  { id: "pain", label: "Pain", plain: "watch it break" },
  { id: "play", label: "Play", plain: "fix it" },
  { id: "proof", label: "Proof", plain: "interview questions" },
  { id: "recall", label: "Recall", plain: "rebuild from memory" },
];

/**
 * The four beats of every level, with a line that fills as you go and a pill that follows you. The
 * current beat also says what it means in plain words, so the names never need learning first.
 */
export function BeatStepper({ current, playProgress = 0 }: { current: RiftBeat; playProgress?: number }) {
  const index = current === "reward" ? BEATS.length : BEATS.findIndex((b) => b.id === current);
  const fill = Math.min(1, (index + (current === "play" ? playProgress : 0)) / (BEATS.length - 1));
  return (
    <ol className="relative flex items-center justify-between gap-2 pb-5" aria-label="Level progress">
      <span className="absolute left-3 right-3 top-[calc(50%-10px)] h-0.5 -translate-y-1/2 rounded-full bg-line" aria-hidden="true" />
      <motion.span
        className="absolute left-3 right-3 top-[calc(50%-11px)] h-0.5 rounded-full bg-flow"
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
              className={`relative rounded-full border px-3 py-1 font-mono text-xs transition-colors duration-300 ${
                state === "current" ? "border-flow text-bg" : state === "done" ? "border-flow/60 bg-surface text-flow" : "border-line bg-surface text-ink-quiet"
              }`}
            >
              {/* One pill that glides from beat to beat as the level moves on. */}
              {state === "current" && (
                <motion.span layoutId="beat-pill" className="absolute -inset-px rounded-full bg-flow shadow-glow" transition={{ type: "spring", stiffness: 300, damping: 30 }} aria-hidden="true" />
              )}
              <span className="relative">{b.label}</span>
            </span>
            {state === "current" && (
              <span className={`absolute top-full mt-1 whitespace-nowrap text-[11px] text-ink-quiet ${i === 0 ? "left-0" : i === BEATS.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"}`}>
                {b.plain}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
