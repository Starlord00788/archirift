"use client";

import { motion } from "motion/react";

export type MeterTone = "flow" | "good" | "warn" | "fail" | "player" | "pink" | "lime";

export const toneVar: Record<MeterTone, string> = {
  flow: "var(--flow)",
  good: "var(--good)",
  warn: "var(--warn)",
  fail: "var(--fail)",
  player: "var(--player)",
  pink: "var(--pink)",
  lime: "var(--lime)",
};

/** An animated bar. `value` is 0..1 (values above 1 show as full). */
export function Meter({ value, tone = "flow", label, height = 8, showValue = false }: { value: number; tone?: MeterTone; label: string; height?: number; showValue?: boolean }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        className="relative w-full overflow-hidden rounded-full bg-line/60"
        style={{ height }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: toneVar[tone], boxShadow: `0 0 12px ${toneVar[tone]}` }}
          initial={false}
          animate={{ width: `${clamped * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      {showValue && <span className="w-12 shrink-0 text-right font-mono text-xs text-ink-quiet">{Number.isFinite(value) ? `${Math.round(value * 100)}%` : "∞"}</span>}
    </div>
  );
}

/** A circular progress ring. */
export function ProgressRing({ value, size = 44, stroke = 4, tone = "flow", children }: { value: number; size?: number; stroke?: number; tone?: MeterTone; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneVar[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  );
}
