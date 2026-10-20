"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Meter } from "@/components/ui/Meter";
import type { SimConfig, SimKnob, SimStageSchema } from "@/content/rift";
import type { z } from "zod";
import { SIM, simulate } from "../../sim";
import type { StageState } from "../../state";
import { Rich } from "../Rich";
import type { Dispatch } from "../types";
import { SimBoard } from "./SimBoard";

type Stage = z.infer<typeof SimStageSchema>;
type State = Extract<StageState, { kind: "sim" }>;

const KNOBS: Record<SimKnob, { label: string; help: string; kind: "count" | "toggle" | "size"; min?: number; max?: number; cost: string }> = {
  servers: { label: "App servers", help: "Horizontal scaling: more identical, stateless servers behind a load balancer.", kind: "count", min: 1, max: 40, cost: "₹4k+ each" },
  serverSize: { label: "Server size", help: "Vertical scaling: a bigger machine. Easy, but price grows faster than power, and there's a ceiling.", kind: "size", cost: "S ₹4k → XL ₹48k" },
  cache: { label: "Cache", help: "Keeps hot reads in memory (cache-aside). Hits skip the database entirely.", kind: "toggle", cost: `₹${SIM.cacheCost}k` },
  cdn: { label: "CDN", help: "Serves static files from edge servers near users.", kind: "toggle", cost: `₹${SIM.cdnCost}k` },
  replicas: { label: "Read replicas", help: "Copies of the database that serve reads. Writes still go to the primary.", kind: "count", min: 0, max: 10, cost: `₹${SIM.replicaCost}k each per shard` },
  shards: { label: "Shards", help: "Split data across databases by a key, so writes spread out.", kind: "count", min: 1, max: 16, cost: `₹${SIM.dbCost}k each` },
  queue: { label: "Message queue", help: "Accept writes instantly and process them in the background.", kind: "toggle", cost: `₹${SIM.queueCost}k` },
  workers: { label: "Queue workers", help: `Each worker drains about ${SIM.workerRate} messages a second.`, kind: "count", min: 0, max: 40, cost: `₹${SIM.workerCost}k each` },
  rateLimit: { label: "Rate limiter", help: "Caps requests per client, so abusive traffic is rejected at the door.", kind: "toggle", cost: `₹${SIM.rateLimitCost}k` },
  breaker: { label: "Circuit breaker", help: "Stops calling a failing dependency and returns a fallback fast.", kind: "toggle", cost: `₹${SIM.breakerCost}k` },
};

/** The traffic simulator: tune the architecture, then survive each wave of traffic. */
export function SimStage({ stage, state, dispatch }: { stage: Stage; state: State; dispatch: Dispatch }) {
  const { sim } = stage;
  const wave = sim.waves[Math.min(state.wave, sim.waves.length - 1)];
  const preview = useMemo(() => simulate(state.config, wave, sim.goals), [state.config, wave, sim.goals]);
  const set = (patch: Partial<SimConfig>) => dispatch({ type: "simSet", config: { ...state.config, ...patch } });

  const goals = [
    { id: "latency", label: "Avg latency", value: `${preview.avgMs} ms`, target: `≤ ${sim.goals.avgMs} ms`, ok: preview.checks.latency, meter: preview.avgMs / sim.goals.avgMs },
    { id: "errors", label: "Errors", value: `${preview.errorPct}%`, target: `≤ ${sim.goals.errorPct}%`, ok: preview.checks.errors, meter: sim.goals.errorPct === 0 ? (preview.errorPct > 0 ? 1.2 : 0) : preview.errorPct / sim.goals.errorPct },
    { id: "budget", label: "Monthly cost", value: `₹${preview.cost}k`, target: `≤ ₹${sim.goals.budget}k`, ok: preview.checks.budget, meter: preview.cost / sim.goals.budget },
    ...(sim.knobs.includes("queue") ? [{ id: "backlog", label: "Queue growth", value: `${preview.backlogPerSec}/s`, target: `≤ ${sim.goals.backlogPerSec}/s`, ok: preview.checks.backlog, meter: preview.backlogPerSec > sim.goals.backlogPerSec ? 1.2 : 0.2 }] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-wrap gap-2" aria-label="Traffic waves">
        {sim.waves.map((w, i) => {
          const done = state.done || i < state.wave;
          const now = !state.done && i === state.wave;
          return (
            <li key={w.name} aria-current={now ? "step" : undefined} className={`flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs ${done ? "border-good/60 text-good" : now ? "border-flow bg-flow/10 text-flow" : "border-line text-ink-quiet"}`}>
              {done ? <Icon name="check" size={12} /> : <span>{i + 1}</span>}
              {w.name}
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div key={state.done ? "done" : state.wave} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-flow/40 bg-flow/5 p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-flow">{state.done ? "All waves survived" : `Wave ${state.wave + 1}: ${wave.name}`}</p>
          <p className="mt-1 text-sm">
            <Rich text={state.done ? "Your architecture held up against everything the city threw at it." : wave.story} inline />
          </p>
          {!state.done && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-quiet">
              <span>{wave.rps.toLocaleString("en-IN")} req/s</span>
              <span>{Math.round(wave.readRatio * 100)}% reads</span>
              {wave.staticRatio > 0 && <span>{Math.round(wave.staticRatio * 100)}% static files</span>}
              {wave.botRps > 0 && <span className="text-warn">+{wave.botRps.toLocaleString("en-IN")} bot req/s</span>}
              {wave.serverCrash && <span className="text-fail">a server will crash</span>}
              {wave.dependencyDown > 0 && <span className="text-fail">payments API is hanging</span>}
              {wave.hotKeyShare > 0 && <span className="text-warn">{Math.round(wave.hotKeyShare * 100)}% of writes hit one key</span>}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-4" disabled={state.done}>
          <legend className="px-1 font-display font-semibold">Architecture</legend>
          {sim.knobs.map((knob) => {
            const k = KNOBS[knob];
            const value = state.config[knob];
            if (knob === "workers" && !state.config.queue) return null;
            return (
              <div key={knob} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium" id={`knob-${knob}`}>
                    {k.label}
                  </span>
                  {k.kind === "toggle" && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(value)}
                      aria-labelledby={`knob-${knob}`}
                      onClick={() => set({ [knob]: !value } as Partial<SimConfig>)}
                      className={`relative h-6 w-11 rounded-full border transition-colors ${value ? "border-flow bg-flow/30" : "border-line bg-bg/60"}`}
                    >
                      <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 32 }} className={`absolute top-0.5 h-4.5 w-4.5 rounded-full ${value ? "right-0.5 bg-flow" : "left-0.5 bg-ink-quiet"}`} />
                    </button>
                  )}
                  {k.kind === "count" && (
                    <span className="flex items-center gap-1" role="group" aria-labelledby={`knob-${knob}`}>
                      <button type="button" className="h-7 w-7 rounded-lg border border-line hover:border-flow disabled:opacity-30" disabled={(value as number) <= (k.min ?? 0)} onClick={() => set({ [knob]: (value as number) - 1 } as Partial<SimConfig>)} aria-label={`Fewer ${k.label.toLowerCase()}`}>
                        −
                      </button>
                      <motion.span key={value as number} initial={{ scale: 1.3, color: "var(--flow)" }} animate={{ scale: 1, color: "var(--ink)" }} className="w-8 text-center font-mono text-sm font-bold" aria-live="polite">
                        {value as number}
                      </motion.span>
                      <button type="button" className="h-7 w-7 rounded-lg border border-line hover:border-flow disabled:opacity-30" disabled={(value as number) >= (k.max ?? 40)} onClick={() => set({ [knob]: (value as number) + 1 } as Partial<SimConfig>)} aria-label={`More ${k.label.toLowerCase()}`}>
                        +
                      </button>
                    </span>
                  )}
                </div>
                {k.kind === "size" && (
                  <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-labelledby={`knob-${knob}`}>
                    {SIM.sizeNames.map((name, i) => (
                      <button key={name} type="button" role="radio" aria-checked={value === i + 1} onClick={() => set({ serverSize: i + 1 })} className={`rounded-lg border py-1 font-mono text-xs ${value === i + 1 ? "border-flow bg-flow/15 text-flow" : "border-line text-ink-quiet hover:border-flow"}`}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-ink-quiet">
                  {k.help} <span className="font-mono text-[10.5px] text-ink-quiet/80">({k.cost})</span>
                </p>
              </div>
            );
          })}
        </fieldset>

        <div className="flex flex-col gap-4">
          <SimBoard config={state.config} result={preview} />

          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {goals.map((g) => (
              <div key={g.id} className={`flex flex-col gap-1.5 rounded-xl border p-3 ${g.ok ? "border-good/50" : "border-fail/60"}`}>
                <dt className="flex items-center justify-between text-xs text-ink-quiet">
                  {g.label}
                  <span className={g.ok ? "text-good" : "text-fail"}>
                    <Icon name={g.ok ? "check" : "x"} size={13} />
                    <span className="sr-only">{g.ok ? "goal met" : "goal missed"}</span>
                  </span>
                </dt>
                <dd className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-xl font-bold">{g.value}</span>
                  <span className="font-mono text-[10.5px] text-ink-quiet">{g.target}</span>
                </dd>
                <Meter value={g.meter} tone={g.ok ? "good" : "fail"} label={`${g.label} against the goal`} height={4} />
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-1.5">
            {preview.tiers.map((t) => (
              <div key={t.id} className="grid grid-cols-[150px_1fr] items-center gap-3 text-xs">
                <span className="truncate text-ink-quiet">{t.label}</span>
                <Meter value={t.utilisation} tone={!Number.isFinite(t.utilisation) || t.utilisation >= 1 ? "fail" : t.utilisation >= 0.8 ? "warn" : "good"} label={`${t.label} utilisation`} height={6} showValue />
              </div>
            ))}
          </div>

          {!state.done && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={() => dispatch({ type: "simRun" })}>
                <Icon name="play" size={14} filled /> Run wave {state.wave + 1}
              </Button>
              <span className="text-xs text-ink-quiet">{preview.passed ? "Projection: this should hold." : `Projection: ${preview.findings[0] ?? "goals not met"}`}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
