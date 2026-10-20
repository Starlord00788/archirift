"use client";

import { motion, useMotionTemplate, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

/**
 * A card whose gradient border turns and whose glow swells as the page scrolls past it,
 * driven by scroll position through useScroll and useTransform (no timers).
 */
export function ScrollGlowCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const angle = useTransform(scrollYProgress, [0, 1], [0, 360]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1.08, 0.9]);
  const border = useMotionTemplate`conic-gradient(from ${angle}deg, var(--flow), var(--player), var(--pink), transparent 55%, var(--flow))`;

  return (
    <div ref={ref} className={`relative overflow-hidden rounded-3xl p-px ${className}`}>
      <motion.div aria-hidden="true" className="absolute -inset-[60%]" style={{ background: border, rotate: 0 }} />
      <div className="relative h-full overflow-hidden rounded-[calc(1.5rem-1px)] bg-surface">
        <motion.div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_80%_at_20%_0%,color-mix(in_srgb,var(--flow)_14%,transparent),transparent_70%)]" style={{ scale }} />
        <div className="relative h-full">{children}</div>
      </div>
    </div>
  );
}
