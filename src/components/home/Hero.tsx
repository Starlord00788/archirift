"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { KineticText, SPRING } from "@/components/fx/KineticText";
import { Magnetic } from "@/components/fx/Magnetic";
import { ParticleMorph } from "@/components/fx/ParticleMorph";
import { SHAPES } from "@/components/fx/shapes";
import { Icon } from "@/components/ui/Icon";

/** The opening scene: a city of particles that keeps rebuilding itself, and one clear way in. */
export function Hero({ startHref, levels }: { startHref: string; levels: number }) {
  const [shape, setShape] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // As you scroll away, the city sinks and fades: a small parallax that makes the page feel deep.
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <section ref={ref} aria-labelledby="hero-title" className="relative isolate -mx-4 flex min-h-[calc(100svh-4rem)] flex-col justify-end overflow-hidden px-4 pb-10 pt-8 sm:-mx-6 sm:px-6 lg:pb-16">
      <motion.div style={reduced ? undefined : { y: sceneY, opacity: sceneOpacity }} className="absolute inset-x-0 top-0 -z-10 h-[62%] sm:h-[72%] lg:bottom-[14%] lg:left-[28%] lg:h-auto">
        <ParticleMorph shape={shape} onAutoAdvance={setShape} className="opacity-60 sm:opacity-100" />
      </motion.div>
      {/* A soft scrim keeps the words readable over the particles. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_55%_at_0%_100%,var(--bg)_35%,transparent_75%)]" />

      <motion.div style={reduced ? undefined : { y: textY }} className="grid items-end gap-10 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="font-mono text-[11px] uppercase tracking-[0.3em] text-flow">
            Build it · Break it · Scale it
          </motion.p>
          <h1 id="hero-title" className="font-display text-[clamp(2.6rem,6.4vw,4.9rem)] font-bold leading-[0.98] tracking-[-0.045em] lg:whitespace-nowrap">
            <KineticText segments={[{ text: "Learn system design" }]} className="block" />
            <KineticText segments={[{ text: "by saving a" }, { text: "city.", className: "text-gradient" }]} className="block" delay={0.24} />
          </h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.55 }} className="max-w-lg text-lg leading-relaxed text-ink-quiet">
            Watch a badly designed system break. Fix it with your own hands. Win the interview. {levels} ten-minute levels, but you won&apos;t need all of them: tell us
            when your interview is and we&apos;ll pick the ones that matter. Free, forever.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.7 }} className="flex flex-wrap items-center gap-4">
            <Magnetic>
              <a
                href="#plan"
                className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-ink px-7 py-4 font-semibold text-bg shadow-glow transition-transform active:scale-95"
              >
                <span className="absolute inset-0 -translate-x-full bg-linear-to-r from-flow to-lamp transition-transform duration-500 ease-out group-hover:translate-x-0" aria-hidden="true" />
                <span className="relative">Make my plan</span>
                <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-bg text-ink transition-transform duration-300 group-hover:translate-x-1">
                  <Icon name="arrowRight" size={14} />
                </span>
              </a>
            </Magnetic>
            <Magnetic strength={0.25}>
              <Link href={startHref} className="inline-flex items-center gap-2 rounded-full border border-line-strong px-6 py-4 font-semibold text-ink transition-colors hover:border-flow hover:text-flow">
                Just start playing
              </Link>
            </Magnetic>
          </motion.div>
        </div>

        <ShapePicker shape={shape} onPick={setShape} />
      </motion.div>

      <motion.a
        href="#map-heading"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="mx-auto mt-10 hidden flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-ink-quiet hover:text-ink sm:flex"
      >
        Explore the city
        <span className="relative h-10 w-px overflow-hidden bg-line" aria-hidden="true">
          <motion.span className="absolute inset-x-0 top-0 h-1/2 bg-flow" animate={reduced ? undefined : { y: ["-100%", "200%"] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
        </span>
      </motion.a>
    </section>
  );
}

/** Four tabs for the four shapes; the active pill glides between them. */
function ShapePicker({ shape, onPick }: { shape: number; onPick: (i: number) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.9 }} className="flex flex-col gap-3 lg:items-end">
      <div className="h-6 overflow-hidden lg:text-right">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p key={shape} initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "-100%", opacity: 0 }} transition={SPRING} className="text-sm text-ink-quiet">
            <span className="font-mono text-xs text-flow">0{shape + 1}/0{SHAPES.length}</span> · {SHAPES[shape].caption}
          </motion.p>
        </AnimatePresence>
      </div>
      <div role="radiogroup" aria-label="Shape of the city" className="flex w-fit gap-1 rounded-full border border-line bg-surface/70 p-1">
        {SHAPES.map((s, i) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={shape === i}
            onClick={() => onPick(i)}
            className={`relative rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${shape === i ? "text-bg" : "text-ink-quiet hover:text-ink"}`}
          >
            {shape === i && <motion.span layoutId="hero-shape" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
            <span className="relative">{s.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
