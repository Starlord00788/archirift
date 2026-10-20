"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LRU_CAPACITY, LRU_SEQUENCE, initialLru, lruAdvance, lruNext, type LruState } from "../../labs";
import { LabShell, restore } from "./LabShell";

interface Data {
  lru: LruState;
  structure: string | null;
}

const INITIAL: Data = { lru: initialLru(), structure: null };
const STRUCTURES = [
  { id: "hash-dll", text: "A hash map from key to node, plus a doubly linked list in recency order", correct: true },
  { id: "array", text: "A sorted array searched with binary search", correct: false },
  { id: "heap", text: "A min-heap ordered by last-used time", correct: false },
  { id: "stacks", text: "Two stacks", correct: false },
];

export function LruLab({ data, onChange, onDone, done }: { data: unknown; onChange: (d: Data) => void; onDone: () => void; done: boolean }) {
  const d = restore(data, INITIAL, ["lru", "structure"]);
  const [wrong, setWrong] = useState<string | null>(null);
  const step = lruNext(d.lru);
  const finished = step === null;
  const key = LRU_SEQUENCE[d.lru.position];
  const structureOk = STRUCTURES.find((s) => s.id === d.structure)?.correct ?? false;
  const goals = [
    { id: "play", text: `Serve all ${LRU_SEQUENCE.length} requests with a ${LRU_CAPACITY}-slot cache, always evicting the least recently used key.`, met: finished },
    { id: "structure", text: "Pick the structures that make get and put O(1).", met: structureOk },
  ];
  useEffect(() => {
    if (!done && finished && structureOk) onDone();
  });

  const advance = (evict?: string) => {
    const result = lruAdvance(d.lru, evict);
    if (!result.correct) {
      setWrong(`Not ${evict}: it was used more recently than ${d.lru.cache[0]}. LRU evicts the key untouched for the longest.`);
    } else setWrong(null);
    onChange({ ...d, lru: result.state });
  };

  return (
    <LabShell goals={goals}>
      <div className="flex flex-wrap gap-1.5" aria-label="Request sequence">
        {LRU_SEQUENCE.map((k, i) => (
          <span key={i} className={`flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-sm ${i < d.lru.position ? "border-line text-ink-quiet/50" : i === d.lru.position ? "border-flow bg-flow/15 font-bold text-flow" : "border-line"}`} aria-current={i === d.lru.position ? "step" : undefined}>
            {k}
          </span>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-surface/50 p-4">
        <p className="mb-3 flex justify-between font-mono text-xs text-ink-quiet">
          <span>least recently used ←</span>
          <span>→ most recently used</span>
        </p>
        <ul className="grid grid-cols-3 gap-3" aria-label="Cache slots">
          <AnimatePresence mode="popLayout">
            {d.lru.cache.map((k) => (
              <motion.li key={k} layout initial={{ opacity: 0, scale: 0.6, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6, y: 20 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} className="flex h-16 items-center justify-center rounded-xl border-2 border-flow/60 bg-flow/10 font-display text-2xl font-bold">
                {k}
              </motion.li>
            ))}
          </AnimatePresence>
          {Array.from({ length: LRU_CAPACITY - d.lru.cache.length }, (_, i) => (
            <li key={`empty-${i}`} className="flex h-16 items-center justify-center rounded-xl border-2 border-dashed border-line text-xs text-ink-quiet">
              empty
            </li>
          ))}
        </ul>
        <p className="mt-3 font-mono text-xs text-ink-quiet">
          hits {d.lru.hits} · misses {d.lru.misses} · wrong evictions {d.lru.mistakes}
        </p>
      </div>

      {!finished && step && (
        <div className="flex flex-col gap-2">
          {step.kind === "evict-needed" ? (
            <>
              <p className="text-sm">
                Request for <strong className="font-mono">{key}</strong>: a miss, and the cache is full. Which key do you evict?
              </p>
              <div className="flex flex-wrap gap-2">
                {step.candidates.map((c) => (
                  <Button key={c} onClick={() => advance(c)}>
                    Evict {c}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm">
                Request for <strong className="font-mono">{key}</strong>: {step.kind === "hit" ? "a hit! It moves to most recently used." : "a miss, with a free slot."}
              </p>
              <Button variant="primary" onClick={() => advance()}>
                Next request
              </Button>
            </div>
          )}
          {wrong && (
            <p role="alert" className="text-sm text-fail">
              {wrong}
            </p>
          )}
        </div>
      )}

      {finished && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Interview follow-up: which structures give O(1) get and put?</legend>
          {STRUCTURES.map((s) => (
            <Button key={s.id} variant="choice" aria-pressed={d.structure === s.id} onClick={() => onChange({ ...d, structure: s.id })} className={d.structure === s.id ? (s.correct ? "border-good" : "border-fail") : ""}>
              {s.text}
            </Button>
          ))}
          {d.structure && !structureOk && <p className="text-sm text-fail">That can&apos;t move an item to the front and drop the tail in constant time. Try again.</p>}
        </fieldset>
      )}
    </LabShell>
  );
}
