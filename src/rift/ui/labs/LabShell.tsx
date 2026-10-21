"use client";

import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";

export interface LabGoal {
  id: string;
  text: string;
  met: boolean;
}

/** Shared frame for a lab: the playground on the left, goals ticking off on the right. */
export function LabShell({ goals, children }: { goals: LabGoal[]; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
      <aside className="flex h-fit flex-col gap-2 rounded-2xl border border-line bg-surface/60 p-4" aria-label="Lab goals">
        <h3 className="font-display font-semibold">Goals</h3>
        <ol className="flex flex-col gap-2">
          {goals.map((g, i) => (
            <motion.li key={g.id} layout className={`flex items-start gap-2 rounded-xl border p-2.5 text-sm ${g.met ? "border-good/60 bg-good/5" : "border-line"}`}>
              <motion.span
                initial={false}
                animate={{ scale: g.met ? [1.4, 1] : 1, backgroundColor: g.met ? "var(--good)" : "rgba(0,0,0,0)" }}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${g.met ? "border-good text-bg" : "border-line-strong text-ink-quiet"}`}
              >
                {g.met ? <Icon name="check" size={12} /> : i + 1}
              </motion.span>
              <span>
                {g.text}
                <span className="sr-only">{g.met ? " (done)" : ""}</span>
              </span>
            </motion.li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

/** Reads a lab's saved data, falling back to a fresh state if it is missing or from an older shape. */
export function restore<T extends object>(data: unknown, initial: T, keys: (keyof T)[]): T {
  if (!data || typeof data !== "object") return initial;
  const value = data as Record<string, unknown>;
  for (const k of keys) if (!((k as string) in value)) return initial;
  return { ...initial, ...(value as Partial<T>) };
}
