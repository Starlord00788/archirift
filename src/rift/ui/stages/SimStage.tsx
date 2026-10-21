"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Meter } from "@/components/ui/Meter";
import type { SimConfig, SimKnob, SimStageSchema } from "@/content/rift";
import type { z } from "zod";
import { SIM, simStars, simulate, waveTimeline, type SimResult } from "../../sim";
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

/** Frames of a played wave, the incidents at each, and the first frame where it broke, if any. */
interface Playback {
  wave: number;
  frames: SimResult[];
  events: string[][];
  rps: number[];
  at: number;
  broke: number | null;
}

const FRAME_MS = 190;

/**
 * The traffic simulator. Plan the architecture against the briefing and your capacity numbers (no
 * spoilers: whether it holds is only known once traffic arrives), then watch the wave play out:
 * traffic ramps up, incidents hit part-way, and the board shows where it bends or breaks.
 */
export function SimStage({ stage, state, dispatch }: { stage: Stage; state: State; dispatch: Dispatch }) {
  const { sim } = stage;
  const reduced = useReducedMotion();
  const wave = sim.waves[Math.min(state.wave, sim.waves.length - 1)];
  const [playback, setPlay] = useState<Playback | null>(null);
  // A playback belongs to the wave it ran; once that wave is survived the next one starts in planning.
  const play = playback && (playback.wave === state.wave || state.done) ? playback : null;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const set = (patch: Partial<SimConfig>) => {
    setPlay(null);
    dispatch({ type: "simSet", config: { ...state.config, ...patch } });
  };

  // Planning view: a trickle of traffic so the board is alive, but nothing that gives the result away.
  const idle = useMemo(() => simulate(state.config, { ...wave, rps: wave.rps * 0.05, botRps: 0, serverCrash: false, dependencyDown: 0 }, sim.goals), [state.config, wave, sim.goals]);
  const capacity = useMemo(() => simulate(state.config, { ...wave, serverCrash: false, dependencyDown: 0 }, sim.goals).tiers, [state.config, wave, sim.goals]);
  const running = play !== null && play.at < play.frames.length - 1;
  const shown = play ? play.frames[play.at] : idle;
  const cost = idle.cost;

  const finish = () => {
    stop();
    setPlay((p) => (p ? { ...p, at: p.frames.length - 1 } : p));
    dispatch({ type: "simRun" });
  };

  const run = () => {
    const timeline = waveTimeline(wave);
    const frames = timeline.map((f) => simulate(state.config, f.wave, sim.goals));
    const broke = frames.findIndex((r) => !(r.checks.latency && r.checks.errors && r.checks.backlog));
    setPlay({ wave: state.wave, frames, events: timeline.map((f) => f.events), rps: timeline.map((f) => f.wave.rps), at: 0, broke: broke === -1 ? null : broke });
    stop();
    let at = 0;
    timer.current = setInterval(
      () => {
        at += 1;
        if (at >= frames.length - 1) finish();
        else setPlay((p) => (p ? { ...p, at } : p));
      },
      reduced ? 40 : FRAME_MS,
    );
  };

  const live = play !== null;
  const ticker = play ? play.events.slice(0, play.at + 1).flatMap((e, i) => e.map((text) => ({ text, i }))).slice(-3) : [];
  const goals = [
    { id: "latency", label: "Avg latency", value: `${shown.avgMs} ms`, target: `≤ ${sim.goals.avgMs} ms`, ok: shown.checks.latency, meter: shown.avgMs / sim.goals.avgMs, always: false },
    { id: "errors", label: "Errors", value: `${shown.errorPct}%`, target: `≤ ${sim.goals.errorPct}%`, ok: shown.checks.errors, meter: sim.goals.errorPct === 0 ? (shown.errorPct > 0 ? 1.2 : 0) : shown.errorPct / sim.goals.errorPct, always: false },
    { id: "budget", label: "Monthly cost", value: `₹${cost}k`, target: `≤ ₹${sim.goals.budget}k`, ok: cost <= sim.goals.budget, meter: cost / sim.goals.budget, always: true },
    ...(sim.knobs.includes("queue")
      ? [{ id: "backlog", label: "Queue growth", value: `${shown.backlogPerSec}/s`, target: `≤ ${sim.goals.backlogPerSec}/s`, ok: shown.checks.backlog, meter: shown.backlogPerSec > sim.goals.backlogPerSec ? 1.2 : 0.2, always: false }]
      : []),
  ];
  const dynamic = wave.rps * (1 - wave.staticRatio);
  const reads = dynamic * wave.readRatio;
  const writes = dynamic - reads;
  const stars = state.done ? simStars(sim, state.runs, state.config) : null;
  const finished = play !== null && !running;
  const failed = finished && state.lastPassed === false;
  const last = play?.frames[play.frames.length - 1];

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
              <span>peak {wave.rps.toLocaleString("en-IN")} req/s</span>
              <span>{Math.round(wave.readRatio * 100)}% reads</span>
              {wave.staticRatio > 0 && <span>{Math.round(wave.staticRatio * 100)}% static files</span>}
              {sim.knobs.includes("cache") && <span>cache would hit {Math.round(wave.cacheHitRate * 100)}% of reads</span>}
              {wave.botRps > 0 && <span className="text-warn">+{wave.botRps.toLocaleString("en-IN")} bot req/s</span>}
              {wave.serverCrash && <span className="text-fail">a server will crash</span>}
              {wave.dependencyDown > 0 && <span className="text-fail">payments API is hanging</span>}
              {wave.hotKeyShare > 0 && <span className="text-warn">{Math.round(wave.hotKeyShare * 100)}% of writes hit one key</span>}
            </p>
          )}
          {stars && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="flex gap-0.5 text-xl text-lime" role="img" aria-label={`${stars.stars} of 3 stars`}>
                {[1, 2, 3].map((n) => (
                  <motion.span key={n} initial={reduced ? false : { scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.15 * n, type: "spring", stiffness: 400, damping: 14 }} className={n <= stars.stars ? "" : "opacity-20"}>
                    ★
                  </motion.span>
                ))}
              </span>
              <span className="font-mono text-xs text-ink-quiet">
                survived · {stars.clean ? "no failed runs" : "failed a run"} · ₹{stars.cost}k against par ₹{stars.par}k{stars.thrifty ? "" : ". Can you hold it for less? Play again."}
              </span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-4" disabled={state.done || running}>
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
          <div className="relative">
            <SimBoard config={state.config} result={shown} />
            {play && (
              <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-bold ${running ? "bg-fail text-bg" : "bg-surface/90 text-ink-quiet"}`}>
                  {running ? `● LIVE · ${Math.round(play.rps[play.at]).toLocaleString("en-IN")} req/s` : "Peak of the wave"}
                </span>
                <span className="h-1.5 w-32 overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <span className="block h-full bg-flow transition-[width] duration-150" style={{ width: `${(play.at / (play.frames.length - 1)) * 100}%` }} />
                </span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-start gap-1" aria-live="polite">
              <AnimatePresence>
                {ticker.map((e) => (
                  <motion.span key={`${e.i}-${e.text}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="rounded-lg bg-surface/90 px-2 py-1 font-mono text-[11px] text-warn">
                    {e.text}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {goals.map((g) => {
              const known = live || g.always;
              return (
                <div key={g.id} className={`flex flex-col gap-1.5 rounded-xl border p-3 ${!known ? "border-line" : g.ok ? "border-good/50" : "border-fail/60"}`}>
                  <dt className="flex items-center justify-between text-xs text-ink-quiet">
                    {g.label}
                    {known && (
                      <span className={g.ok ? "text-good" : "text-fail"}>
                        <Icon name={g.ok ? "check" : "x"} size={13} />
                        <span className="sr-only">{g.ok ? "goal met" : "goal missed"}</span>
                      </span>
                    )}
                  </dt>
                  <dd className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-xl font-bold">{known ? g.value : "?"}</span>
                    <span className="font-mono text-[10.5px] text-ink-quiet">{g.target}</span>
                  </dd>
                  <Meter value={known ? g.meter : 0} tone={g.ok || !known ? "good" : "fail"} label={`${g.label} against the goal`} height={4} />
                </div>
              );
            })}
          </dl>

          {live ? (
            <div className="flex flex-col gap-1.5">
              {shown.tiers.map((t) => (
                <div key={t.id} className="grid grid-cols-[150px_1fr] items-center gap-3 text-xs">
                  <span className="truncate text-ink-quiet">{t.label}</span>
                  <Meter value={t.utilisation} tone={!Number.isFinite(t.utilisation) || t.utilisation >= 1 ? "fail" : t.utilisation >= 0.8 ? "warn" : "good"} label={`${t.label} utilisation`} height={6} showValue />
                </div>
              ))}
            </div>
          ) : (
            !state.done && (
              <div className="grid gap-3 rounded-xl border border-line bg-surface/40 p-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="mb-1 font-mono uppercase tracking-widest text-ink-quiet">At peak, incoming</p>
                  <ul className="flex flex-col gap-0.5 font-mono">
                    <li>{Math.round(reads).toLocaleString("en-IN")} reads/s</li>
                    <li>{Math.round(writes).toLocaleString("en-IN")} writes/s</li>
                    {wave.staticRatio > 0 && <li>{Math.round(wave.rps * wave.staticRatio).toLocaleString("en-IN")} static files/s</li>}
                    {wave.botRps > 0 && <li className="text-warn">{wave.botRps.toLocaleString("en-IN")} bot requests/s</li>}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-mono uppercase tracking-widest text-ink-quiet">Your capacity</p>
                  <ul className="flex flex-col gap-0.5 font-mono">
                    {capacity.map((t) => (
                      <li key={t.id}>
                        {t.label}: {Math.round(t.capacity).toLocaleString("en-IN")}/s
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-ink-quiet sm:col-span-2">Do the maths like you would at a whiteboard: once the cache, CDN, replicas and queue have done their part, can every tier keep up?</p>
              </div>
            )
          )}

          {failed && play && last && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-1.5 rounded-xl border border-fail/60 bg-fail/5 p-3 text-sm">
              <p className="font-semibold text-fail">Post-mortem</p>
              {play.broke !== null && (
                <p className="text-ink-quiet">
                  It started failing {Math.round((play.broke / (play.frames.length - 1)) * 100)}% of the way in, at about {Math.round(play.rps[play.broke]).toLocaleString("en-IN")} req/s.
                </p>
              )}
              <ul className="list-disc pl-5">
                {last.findings.slice(0, 3).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </motion.div>
          )}

          {!state.done && (
            <div className="flex flex-wrap items-center gap-3">
              {running ? (
                <Button onClick={finish}>Skip to the result</Button>
              ) : (
                <Button variant="primary" onClick={run}>
                  <Icon name="play" size={14} filled /> Run wave {state.wave + 1}
                </Button>
              )}
              {!running && <span className="text-xs text-ink-quiet">{failed ? "Change the design, then run it again." : "You'll only know once the traffic arrives."}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
