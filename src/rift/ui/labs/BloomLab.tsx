"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { BLOOM_PROBES, BLOOM_WORDS, bloomBits, bloomFalsePositiveRate, bloomMightContain, bloomPositions } from "../../labs";
import { LabShell, restore } from "./LabShell";

interface Data {
  bits: number;
  hashes: number;
  added: string[];
  probes: { word: string; maybe: boolean; bits: number }[];
  goals: { added: boolean; falsePositive: boolean; tuned: boolean };
}

const INITIAL: Data = { bits: 16, hashes: 2, added: [], probes: [], goals: { added: false, falsePositive: false, tuned: false } };
const SIZES = [16, 32, 64, 128];

export function BloomLab({ data, onChange, onDone, done }: { data: unknown; onChange: (d: Data) => void; onDone: () => void; done: boolean }) {
  const d = restore(data, INITIAL, ["bits", "hashes", "added", "probes", "goals"]);
  const [focus, setFocus] = useState<string | null>(null);
  const set = useMemo(() => bloomBits(d.added, d.bits, d.hashes), [d.added, d.bits, d.hashes]);
  const fp = bloomFalsePositiveRate(d.added.length, d.bits, d.hashes);
  const lit = focus ? new Set(bloomPositions(focus, d.bits, d.hashes)) : new Set<number>();
  const goals = [
    { id: "added", text: "Add all eight usernames to the filter.", met: d.goals.added },
    { id: "falsePositive", text: "Check names nobody registered until the filter wrongly says “maybe taken”. That's a false positive.", met: d.goals.falsePositive },
    { id: "tuned", text: "Change the size (m) or hash count (k) until the expected false-positive rate is under 5%.", met: d.goals.tuned },
  ];

  useEffect(() => {
    if (!done && goals.every((g) => g.met)) onDone();
  });

  const update = (next: Data) => {
    const rate = bloomFalsePositiveRate(next.added.length, next.bits, next.hashes);
    const tuned = next.goals.tuned || (next.goals.falsePositive && next.added.length === BLOOM_WORDS.length && rate < 0.05);
    onChange({ ...next, goals: { ...next.goals, added: next.added.length === BLOOM_WORDS.length, tuned } });
  };

  return (
    <LabShell goals={goals}>
      <p className="text-sm text-ink-quiet">
        A sign-up form asks “is this username taken?” millions of times a day. A Bloom filter answers from memory: <strong className="text-ink">definitely not</strong>, or <strong className="text-ink">maybe</strong> (then
        you check the database).
      </p>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-2">
          Bits (m)
          <span className="flex gap-1" role="radiogroup" aria-label="Number of bits">
            {SIZES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={d.bits === m} onClick={() => update({ ...d, bits: m })} className={`rounded-lg border px-2 py-1 font-mono text-xs ${d.bits === m ? "border-flow bg-flow/15 text-flow" : "border-line text-ink-quiet"}`}>
                {m}
              </button>
            ))}
          </span>
        </span>
        <span className="flex items-center gap-2">
          Hashes (k)
          <span className="flex gap-1" role="radiogroup" aria-label="Number of hash functions">
            {[1, 2, 3, 4].map((k) => (
              <button key={k} type="button" role="radio" aria-checked={d.hashes === k} onClick={() => update({ ...d, hashes: k })} className={`rounded-lg border px-2 py-1 font-mono text-xs ${d.hashes === k ? "border-flow bg-flow/15 text-flow" : "border-line text-ink-quiet"}`}>
                {k}
              </button>
            ))}
          </span>
        </span>
        <span className={`font-mono text-xs ${fp < 0.05 ? "text-good" : "text-warn"}`}>expected false positives: {(fp * 100).toFixed(1)}%</span>
      </div>

      <div className="grid gap-1 rounded-2xl border border-line bg-surface/50 p-3" style={{ gridTemplateColumns: `repeat(${Math.min(d.bits, 32)}, minmax(0, 1fr))` }} role="img" aria-label={`${set.filter(Boolean).length} of ${d.bits} bits are set`}>
        {set.map((on, i) => (
          <motion.span
            key={`${d.bits}-${i}`}
            initial={false}
            animate={{ backgroundColor: lit.has(i) ? "var(--pink)" : on ? "var(--flow)" : "var(--surface-2)", scale: lit.has(i) ? 1.15 : 1 }}
            className="aspect-square rounded-[4px]"
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold">Register a username</h4>
          <div className="flex flex-wrap gap-2">
            {BLOOM_WORDS.map((w) => {
              const on = d.added.includes(w);
              return (
                <button key={w} type="button" disabled={on} onMouseEnter={() => setFocus(w)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(w)} onBlur={() => setFocus(null)} onClick={() => update({ ...d, added: [...d.added, w] })} className={`rounded-full border px-3 py-1 font-mono text-xs ${on ? "border-flow/60 text-flow" : "border-line hover:border-flow"}`}>
                  {on ? "✓ " : "+ "}
                  {w}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Is this name taken? (nobody registered these)</h4>
          <div className="flex flex-wrap gap-2">
            {BLOOM_PROBES.map((w) => (
              <button
                key={w}
                type="button"
                onMouseEnter={() => setFocus(w)}
                onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(w)}
                onBlur={() => setFocus(null)}
                onClick={() => {
                  const maybe = bloomMightContain(set, w, d.hashes);
                  update({ ...d, probes: [{ word: w, maybe, bits: d.bits }, ...d.probes].slice(0, 6), goals: { ...d.goals, falsePositive: d.goals.falsePositive || maybe } });
                }}
                className="rounded-full border border-line px-3 py-1 font-mono text-xs hover:border-pink"
              >
                ? {w}
              </button>
            ))}
          </div>
          <ul className="mt-3 flex flex-col gap-1 text-xs" aria-live="polite">
            {d.probes.map((p, i) => (
              <motion.li key={`${p.word}-${i}-${d.probes.length}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={p.maybe ? "text-warn" : "text-good"}>
                {p.word}: {p.maybe ? "maybe taken (false positive! nobody has it)" : "definitely available"} <span className="text-ink-quiet">(m={p.bits})</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </LabShell>
  );
}
