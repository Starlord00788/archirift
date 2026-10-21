"use client";

import { motion, useReducedMotion } from "motion/react";

const FLOORS = 5;
const FH = 13;
const BASE = 92;

// Window panes on the left and right faces, as on TowerRise.
const leftWin = (x1: number, x2: number, yt: number, yb: number) =>
  `${x1},${yt + (x1 - 18) * 0.5 + 3.5} ${x2},${yt + (x2 - 18) * 0.5 + 3.5} ${x2},${yb + (x2 - 18) * 0.5 - 3.5} ${x1},${yb + (x1 - 18) * 0.5 - 3.5}`;
const rightWin = (x1: number, x2: number, yt: number, yb: number) =>
  `${x1},${yt + 15 - (x1 - 48) * 0.5 + 3.5} ${x2},${yt + 15 - (x2 - 48) * 0.5 + 3.5} ${x2},${yb + 15 - (x2 - 48) * 0.5 - 3.5} ${x1},${yb + 15 - (x1 - 48) * 0.5 - 3.5}`;

export type SiteCondition = "tearing" | "repairing" | "standing";

/**
 * The building this level is about, as it stands right now: tearing apart while you watch the
 * problem, under scaffolding while you fix it, and standing (still unlit) once the fix holds. The
 * same tower that rises lit on the reward screen and the city map. Decorative only.
 *
 * `floors` (0–5) is how much of it stands while repairing. `jolt` changes whenever something
 * hits the building, which shakes it.
 */
export function SiteTower({ condition, floors = FLOORS, jolt = 0, size = 56 }: { condition: SiteCondition; floors?: number; jolt?: number; size?: number }) {
  const reduced = useReducedMotion();
  const standing = condition === "tearing" ? FLOORS : condition === "repairing" ? Math.max(1, Math.min(FLOORS, floors)) : FLOORS;
  const tearing = condition === "tearing";
  const top = BASE - FLOORS * FH;

  return (
    <motion.svg
      key={jolt}
      width={size}
      height={(size * 116) / 96}
      viewBox="0 0 96 116"
      aria-hidden="true"
      className="shrink-0 overflow-visible"
      initial={reduced || jolt === 0 ? false : { x: 0 }}
      animate={reduced || jolt === 0 ? undefined : { x: [0, -5, 5, -3, 3, 0], rotate: [0, -1.5, 1.5, -0.8, 0.5, 0] }}
      transition={{ duration: 0.45 }}
      style={{ transformOrigin: "48px 100px" }}
    >
      <polygon points={`48,${BASE - 18} 88,${BASE + 2} 48,${BASE + 22} 8,${BASE + 2}`} fill={`color-mix(in srgb, var(--${tearing ? "fail" : "flow"}) 8%, transparent)`} stroke="var(--line-strong)" strokeWidth="1" />

      {Array.from({ length: FLOORS }, (_, i) => {
        const yb = BASE - i * FH;
        const yt = yb - FH;
        const built = i < standing;
        // The top two floors shear off sideways while the building tears.
        const shear = tearing && i >= 3 ? (i - 2) * 4 : 0;
        return (
          <g key={i} transform={shear ? `translate(${shear} ${-shear * 0.4}) rotate(${shear * 0.6} 48 ${yb})` : undefined}>
            <polygon
              points={`18,${yt} 48,${yt + 15} 48,${yb + 15} 18,${yb}`}
              fill={built ? "var(--surface)" : "none"}
              stroke={built ? "var(--line-strong)" : "var(--ink-quiet)"}
              strokeOpacity={built ? 1 : 0.55}
              strokeDasharray={built ? undefined : "3 3"}
              strokeWidth="1"
            />
            <polygon
              points={`48,${yt + 15} 78,${yt} 78,${yb} 48,${yb + 15}`}
              fill={built ? "var(--surface-2)" : "none"}
              stroke={built ? "var(--line-strong)" : "var(--ink-quiet)"}
              strokeOpacity={built ? 1 : 0.55}
              strokeDasharray={built ? undefined : "3 3"}
              strokeWidth="1"
            />
            {built &&
              [0, 1, 2, 3].map((k) => (
                <motion.polygon
                  key={k}
                  points={k < 2 ? leftWin(22 + k * 13, 31 + k * 13, yt, yb) : rightWin(52 + (k - 2) * 13, 61 + (k - 2) * 13, yt, yb)}
                  fill={tearing ? "var(--fail)" : "var(--lamp)"}
                  initial={false}
                  animate={tearing && !reduced ? { opacity: [0.85, 0.1, 0.6, 0.05, 0.85] } : { opacity: tearing ? 0.5 : 0.12 }}
                  transition={tearing && !reduced ? { duration: 1.1 + ((i * 3 + k) % 4) * 0.35, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
                />
              ))}
          </g>
        );
      })}

      {/* A crack running down the front corner. */}
      {tearing && (
        <polyline
          points={`48,${top + 18} 44,${top + 27} 51,${top + 34} 45,${top + 44} 50,${top + 52}`}
          fill="none"
          stroke="var(--fail)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}

      {/* Debris falling from the sheared floors. */}
      {tearing &&
        !reduced &&
        [0, 1, 2].map((k) => (
          <motion.rect
            key={k}
            x={70 + k * 6}
            y={top + 10}
            width="3"
            height="3"
            fill="var(--warn)"
            animate={{ y: [0, 70], opacity: [1, 0], rotate: [0, 180] }}
            transition={{ duration: 1.4, delay: k * 0.45, repeat: Infinity, ease: "easeIn" }}
          />
        ))}

      {/* Scaffolding up the side while it's being repaired. */}
      {condition === "repairing" && (
        <g stroke="var(--warn)" strokeWidth="1" opacity="0.8">
          <line x1="84" y1={BASE + 4} x2="84" y2={top - 4} />
          <line x1="90" y1={BASE + 6} x2="90" y2={top - 2} />
          {Array.from({ length: FLOORS }, (_, i) => (
            <line key={i} x1="84" y1={BASE - i * FH} x2="90" y2={BASE - i * FH + 2} />
          ))}
        </g>
      )}
    </motion.svg>
  );
}
