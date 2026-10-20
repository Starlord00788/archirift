"use client";

import { motion, useReducedMotion } from "motion/react";

const FLOORS = 5;
const FH = 13;
const BASE = 92;

/**
 * The building a finished level adds to the city: floors drop into place one by one, then the
 * windows light up. The same tower you will find standing on the city map. Decorative only.
 */
export function TowerRise({ size = 96 }: { size?: number }) {
  const reduced = useReducedMotion();
  const floors = Array.from({ length: FLOORS }, (_, i) => {
    const yb = BASE - i * FH;
    return { i, yb, yt: yb - FH };
  });
  const top = BASE - FLOORS * FH;
  const lit = [
    [1, 1],
    [1, 0],
    [0, 1],
    [1, 1],
    [1, 1],
  ];
  const leftWin = (x1: number, x2: number, yt: number, yb: number) =>
    `${x1},${yt + (x1 - 18) * 0.5 + 3.5} ${x2},${yt + (x2 - 18) * 0.5 + 3.5} ${x2},${yb + (x2 - 18) * 0.5 - 3.5} ${x1},${yb + (x1 - 18) * 0.5 - 3.5}`;
  const rightWin = (x1: number, x2: number, yt: number, yb: number) =>
    `${x1},${yt + 15 - (x1 - 48) * 0.5 + 3.5} ${x2},${yt + 15 - (x2 - 48) * 0.5 + 3.5} ${x2},${yb + 15 - (x2 - 48) * 0.5 - 3.5} ${x1},${yb + 15 - (x1 - 48) * 0.5 - 3.5}`;

  return (
    <svg width={size} height={(size * 116) / 96} viewBox="0 0 96 116" aria-hidden="true" className="overflow-visible">
      {/* The lot it stands on. */}
      <motion.polygon
        points={`48,${BASE - 18} 88,${BASE + 2} 48,${BASE + 22} 8,${BASE + 2}`}
        fill="color-mix(in srgb, var(--flow) 8%, transparent)"
        stroke="var(--line-strong)"
        strokeWidth="1"
        initial={reduced ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{ transformOrigin: "48px 96px" }}
      />
      {floors.map(({ i, yb, yt }) => (
        <motion.g
          key={i}
          initial={reduced ? false : { y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.15 + i * 0.12 }}
        >
          <polygon points={`18,${yt} 48,${yt + 15} 48,${yb + 15} 18,${yb}`} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1" />
          <polygon points={`48,${yt + 15} 78,${yt} 78,${yb} 48,${yb + 15}`} fill="var(--surface-2)" stroke="var(--line-strong)" strokeWidth="1" />
          {[0, 1].map((k) => (
            <motion.polygon
              key={`l${k}`}
              points={leftWin(22 + k * 13, 31 + k * 13, yt, yb)}
              fill="var(--lamp)"
              initial={reduced ? false : { opacity: 0.12 }}
              animate={{ opacity: lit[i][k] ? 0.95 : 0.12 }}
              transition={{ duration: 0.3, delay: 0.95 + i * 0.07 + k * 0.05 }}
            />
          ))}
          {[0, 1].map((k) => (
            <motion.polygon
              key={`r${k}`}
              points={rightWin(52 + k * 13, 61 + k * 13, yt, yb)}
              fill="var(--lamp)"
              initial={reduced ? false : { opacity: 0.12 }}
              animate={{ opacity: lit[(i + 2) % FLOORS][1 - k] ? 0.75 : 0.12 }}
              transition={{ duration: 0.3, delay: 1.05 + i * 0.07 + k * 0.05 }}
            />
          ))}
        </motion.g>
      ))}
      {/* The roof, tinted with the city's light. */}
      <motion.polygon
        points={`48,${top - 15} 78,${top} 48,${top + 15} 18,${top}`}
        fill="color-mix(in srgb, var(--flow) 35%, var(--surface-2))"
        stroke="var(--flow)"
        strokeWidth="1"
        initial={reduced ? false : { y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.15 + FLOORS * 0.12 }}
      />
    </svg>
  );
}
