"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Meter } from "@/components/ui/Meter";
import { RING_SIZE, SAMPLE_KEYS, assignKeys, fnv1a, imbalance, movedShare, ringPoints, type HashMode } from "../../labs";
import { LabShell, restore } from "./LabShell";

interface Data {
  mode: HashMode;
  servers: number;
  vnodes: number;
  last: { moved: number; mode: HashMode; change: "added" | "removed" } | null;
  goals: { modulo: boolean; ring: boolean; balanced: boolean };
}

const INITIAL: Data = { mode: "modulo", servers: 4, vnodes: 1, last: null, goals: { modulo: false, ring: false, balanced: false } };
const SHOWN = SAMPLE_KEYS.slice(0, 36);
const VNODE_STEPS = [1, 3, 10, 25, 50, 100, 200];
const COLOURS = ["var(--flow)", "var(--player)", "var(--pink)", "var(--lime)", "var(--warn)", "var(--good)", "#60a5fa", "#f97316"];

export function HashRingLab({ data, onChange, onDone, done }: { data: unknown; onChange: (d: Data) => void; onDone: () => void; done: boolean }) {
  const d = restore(data, INITIAL, ["mode", "servers", "vnodes", "goals"]);
  const owners = useMemo(() => assignKeys(SAMPLE_KEYS, d.servers, d.mode, d.vnodes), [d.servers, d.mode, d.vnodes]);
  const spread = imbalance(owners, d.servers);
  const goals = [
    { id: "modulo", text: "With hash % N, add a server. Watch how many keys have to move.", met: d.goals.modulo },
    { id: "ring", text: "Switch to the hash ring and add a server again. Fewer than 30% of keys should move.", met: d.goals.ring },
    { id: "balanced", text: "Load is lumpy with one point per server. Add virtual nodes until the busiest server carries under 1.3× the average.", met: d.goals.balanced },
  ];

  useEffect(() => {
    if (!done && goals.every((g) => g.met)) onDone();
  });

  const resize = (by: 1 | -1) => {
    const next = d.servers + by;
    if (next < 2 || next > 8) return;
    const moved = movedShare(owners, assignKeys(SAMPLE_KEYS, next, d.mode, d.vnodes));
    const g = { ...d.goals };
    if (by === 1 && d.mode === "modulo" && moved > 0.5) g.modulo = true;
    if (by === 1 && d.mode === "ring" && moved < 0.3) g.ring = true;
    const nextOwners = assignKeys(SAMPLE_KEYS, next, d.mode, d.vnodes);
    if (d.mode === "ring" && d.vnodes > 1 && imbalance(nextOwners, next) < 1.3) g.balanced = true;
    onChange({ ...d, servers: next, last: { moved, mode: d.mode, change: by === 1 ? "added" : "removed" }, goals: g });
  };

  const setVnodes = (vnodes: number) => {
    const g = { ...d.goals };
    if (d.mode === "ring" && vnodes > 1 && imbalance(assignKeys(SAMPLE_KEYS, d.servers, "ring", vnodes), d.servers) < 1.3) g.balanced = true;
    onChange({ ...d, vnodes, goals: g, last: null });
  };

  const shownOwners = owners.slice(0, SHOWN.length);
  const points = d.mode === "ring" ? ringPoints(d.servers, Math.min(d.vnodes, 40)) : [];
  const R = 120;
  const angle = (h: number) => (h / RING_SIZE) * Math.PI * 2 - Math.PI / 2;

  return (
    <LabShell goals={goals}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Hashing scheme" className="flex rounded-xl border border-line p-1">
          {(["modulo", "ring"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={d.mode === m} onClick={() => onChange({ ...d, mode: m, last: null, vnodes: m === "modulo" ? 1 : d.vnodes })} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${d.mode === m ? "bg-flow text-bg" : "text-ink-quiet hover:text-ink"}`}>
              {m === "modulo" ? "hash(key) % N" : "Consistent hash ring"}
            </button>
          ))}
        </div>
        <Button onClick={() => resize(1)} disabled={d.servers >= 8}>
          Add a server
        </Button>
        <Button variant="ghost" onClick={() => resize(-1)} disabled={d.servers <= 2}>
          Remove a server
        </Button>
        <span className="font-mono text-xs text-ink-quiet">{d.servers} servers</span>
      </div>

      {d.mode === "ring" && (
        <label className="flex flex-wrap items-center gap-3 text-sm">
          <span>Virtual nodes per server</span>
          <span className="flex gap-1" role="radiogroup" aria-label="Virtual nodes per server">
            {VNODE_STEPS.map((v) => (
              <button key={v} type="button" role="radio" aria-checked={d.vnodes === v} onClick={() => setVnodes(v)} className={`rounded-lg border px-2 py-1 font-mono text-xs ${d.vnodes === v ? "border-flow bg-flow/15 text-flow" : "border-line text-ink-quiet hover:border-flow"}`}>
                {v}
              </button>
            ))}
          </span>
        </label>
      )}

      <div className="grid items-center gap-4 md:grid-cols-[1fr_220px]">
        <div className="rounded-2xl border border-line bg-surface/50 p-2">
          {d.mode === "ring" ? (
            <svg viewBox="-150 -150 300 300" className="mx-auto block h-auto w-full max-w-sm" role="img" aria-label={`Hash ring with ${d.servers} servers and ${d.vnodes} virtual nodes each`}>
              <circle r={R} fill="none" stroke="var(--line-strong)" strokeWidth="2" />
              {points.map((p, i) => {
                const a = angle(p.position);
                return (
                  <motion.rect key={`${p.server}-${i}`} initial={{ scale: 0 }} animate={{ scale: 1 }} x={Math.cos(a) * R - 5} y={Math.sin(a) * R - 5} width="10" height="10" rx="2" fill={COLOURS[p.server % COLOURS.length]} />
                );
              })}
              {SHOWN.map((k, i) => {
                const a = angle(fnv1a(k));
                return <motion.circle key={k} r="3.5" initial={false} animate={{ cx: Math.cos(a) * (R - 18), cy: Math.sin(a) * (R - 18), fill: COLOURS[shownOwners[i] % COLOURS.length] }} transition={{ duration: 0.6 }} />;
              })}
              <text textAnchor="middle" y="4" fontSize="11" fill="var(--ink-quiet)" className="font-mono">
                keys walk clockwise
              </text>
            </svg>
          ) : (
            <div className="grid gap-2 p-2" style={{ gridTemplateColumns: `repeat(${d.servers}, minmax(0, 1fr))` }} role="img" aria-label={`Keys spread over ${d.servers} servers by hash modulo ${d.servers}`}>
              {Array.from({ length: d.servers }, (_, s) => (
                <div key={s} className="flex min-h-40 flex-col items-center gap-1 rounded-xl border border-line p-2">
                  <span className="font-mono text-[10px]" style={{ color: COLOURS[s % COLOURS.length] }}>
                    server {s}
                  </span>
                  <div className="flex flex-wrap justify-center gap-1">
                    {SHOWN.map((k, i) =>
                      shownOwners[i] === s ? <motion.span key={k} layoutId={`key-${k}`} className="h-2.5 w-2.5 rounded-full" style={{ background: COLOURS[s % COLOURS.length] }} /> : null,
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="wait">
            {d.last && (
              <motion.div key={`${d.servers}-${d.last.mode}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`rounded-2xl border p-3 ${d.last.moved > 0.5 ? "border-fail/60 bg-fail/5" : "border-good/60 bg-good/5"}`}>
                <p className="font-mono text-xs text-ink-quiet">Server {d.last.change}</p>
                <p className="font-display text-3xl font-bold">{Math.round(d.last.moved * 100)}%</p>
                <p className="text-xs text-ink-quiet">of keys moved to a different server{d.last.moved > 0.5 ? ": a cache stampede, every one of them is now a miss." : "."}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <div>
            <p className="mb-1 text-xs text-ink-quiet">Busiest server vs average: {spread.toFixed(2)}×</p>
            <Meter value={(spread - 1) / 1.5} tone={spread < 1.3 ? "good" : "warn"} label="Load imbalance" />
          </div>
        </div>
      </div>
    </LabShell>
  );
}
