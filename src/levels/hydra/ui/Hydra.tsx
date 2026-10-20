"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

interface Props {
  /** One head per inline if-else branch. */
  heads: string[];
  defeated: boolean;
  /** Strategy classes, drawn as workers at their own desks once the Hydra is defeated. */
  classes?: string[];
}

/** After the refactor every rule is a worker with its own desk, reporting to Checkout. */
function Desks({ classes, reduced }: { classes: string[]; reduced: boolean }) {
  const width = 116;
  const perRow = 3;
  return (
    <g>
      {classes.map((name, i) => {
        const row = Math.floor(i / perRow);
        const inRow = Math.min(perRow, classes.length - row * perRow);
        const col = i % perRow;
        const x = BODY.x - (inRow * (width + 12) - 12) / 2 + col * (width + 12);
        const y = 30 + row * 70;
        return (
          <motion.g
            key={name}
            initial={reduced ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 0.15 * i, type: "spring", stiffness: 200, damping: 18 }}
          >
            <line x1={x + width / 2} y1={y + 38} x2={BODY.x} y2={BODY.y - 34} stroke="var(--flow)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
            <rect x={x} y={y} width={width} height="38" rx="8" fill="var(--surface)" stroke="var(--flow)" strokeWidth="1.5" />
            <circle cx={x + 14} cy={y + 19} r="6" fill="var(--flow)" opacity="0.8" />
            <text x={x + 26} y={y + 23} fontSize="10" fill="var(--ink)" fontFamily="var(--font-jetbrains-mono)">
              {name.replace("Pricing", "")}
            </text>
          </motion.g>
        );
      })}
    </g>
  );
}

const BODY = { x: 200, y: 250 };

/**
 * The If-Else Hydra: every inline branch of Checkout is a head. Moving a branch into its own class
 * cuts a head; an injected list of strategies defeats it and seals the rift.
 */
export function Hydra({ heads, defeated, classes = [] }: Props) {
  const reduced = useReducedMotion();
  const spread = Math.min(150, 50 * Math.max(1, heads.length - 1));
  const positions = heads.map((_, i) => {
    const t = heads.length === 1 ? 0.5 : i / (heads.length - 1);
    return { x: BODY.x - spread + t * spread * 2, y: 70 + Math.abs(t - 0.5) * 60 };
  });

  return (
    <svg
      viewBox="0 0 400 320"
      role="img"
      aria-label={defeated ? "The Hydra is defeated and the rift is sealed" : `The If-Else Hydra with ${heads.length} heads: ${heads.join(", ")}`}
      className="h-auto w-full max-w-md"
    >
      <defs>
        <radialGradient id="rift-glow">
          <stop offset="0%" stopColor="var(--fail)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--fail)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The rift behind the Hydra; it closes when the design is fixed. */}
      <motion.ellipse
        cx="200"
        cy="285"
        rx={defeated ? 0 : 170}
        ry={defeated ? 0 : 26}
        fill="url(#rift-glow)"
        animate={{ rx: defeated ? 0 : 170, ry: defeated ? 0 : 26 }}
        transition={{ duration: reduced ? 0 : 0.8 }}
      />
      <motion.path
        d="M60 285 L110 278 L140 292 L190 276 L230 294 L270 278 L300 290 L340 282"
        fill="none"
        stroke={defeated ? "var(--flow)" : "var(--fail)"}
        strokeWidth="3"
        strokeLinejoin="round"
        animate={{ pathLength: defeated ? 0 : 1, opacity: defeated ? 0.4 : 1 }}
        transition={{ duration: reduced ? 0 : 0.8 }}
      />

      <AnimatePresence>
        {heads.map((label, i) => {
          const p = positions[i];
          return (
            <motion.g
              key={label}
              initial={reduced ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { rotate: 25, y: 140, opacity: 0, transition: { duration: 0.5 } }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              style={{ originX: `${p.x}px`, originY: `${p.y}px` }}
            >
              <path
                d={`M${BODY.x} ${BODY.y - 20} Q ${(BODY.x + p.x) / 2} ${p.y + 90} ${p.x} ${p.y + 22}`}
                fill="none"
                stroke="var(--fail)"
                strokeWidth="14"
                strokeLinecap="round"
                opacity="0.85"
              />
              <circle cx={p.x} cy={p.y} r="24" fill="var(--surface)" stroke="var(--fail)" strokeWidth="3" />
              <circle cx={p.x - 8} cy={p.y - 4} r="3.5" fill="var(--warn)" />
              <circle cx={p.x + 8} cy={p.y - 4} r="3.5" fill="var(--warn)" />
              <path d={`M${p.x - 8} ${p.y + 9} l4 -4 l4 4 l4 -4 l4 4`} fill="none" stroke="var(--fail)" strokeWidth="2" />
              <text x={p.x} y={p.y - 32} textAnchor="middle" fontSize="11" fill="var(--ink)" fontFamily="var(--font-jetbrains-mono)">
                {label}
              </text>
            </motion.g>
          );
        })}
      </AnimatePresence>

      {defeated && <Desks classes={classes} reduced={Boolean(reduced)} />}

      <motion.ellipse
        cx={BODY.x}
        cy={BODY.y}
        rx="70"
        ry="34"
        fill="var(--surface)"
        stroke={defeated ? "var(--flow)" : "var(--fail)"}
        strokeWidth="3"
      />
      <text x={BODY.x} y={BODY.y + 5} textAnchor="middle" fontSize="13" fill="var(--ink)" fontFamily="var(--font-jetbrains-mono)">
        Checkout.total()
      </text>
      {defeated && (
        <text x={BODY.x} y="312" textAnchor="middle" fontSize="12" fill="var(--flow)" fontFamily="var(--font-jetbrains-mono)">
          rift sealed
        </text>
      )}
    </svg>
  );
}
