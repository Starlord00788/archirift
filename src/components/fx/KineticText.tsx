"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";

export const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

const container: Variants = {
  hidden: {},
  shown: (delay: number) => ({ transition: { staggerChildren: 0.08, delayChildren: delay } }),
};

const word: Variants = {
  hidden: { y: "110%", rotate: 4 },
  shown: { y: "0%", rotate: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
};

/**
 * A headline whose words rise out of hidden masks, one after another. Pass segments to style
 * parts differently (for example a gradient phrase). Screen readers get the plain sentence once.
 */
export function KineticText({
  segments,
  as: Tag = "span",
  className = "",
  delay = 0,
}: {
  segments: { text: string; className?: string }[];
  as?: "h1" | "h2" | "p" | "span";
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const label = segments.map((s) => s.text).join(" ");
  const words = segments.flatMap((s) => s.text.split(" ").map((w) => ({ w, className: s.className ?? "" })));
  const MotionTag = motion[Tag];
  return (
    <MotionTag className={className} initial={reduced ? "shown" : "hidden"} animate="shown" variants={container} custom={delay}>
      <span className="sr-only">{label} </span>
      {words.map(({ w, className: c }, i) => (
        <span key={`${w}-${i}`} aria-hidden="true" className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span className={`inline-block ${c}`} variants={word}>
            {w}
          </motion.span>
          {i < words.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </MotionTag>
  );
}
