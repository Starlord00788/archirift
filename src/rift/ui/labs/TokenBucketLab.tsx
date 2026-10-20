"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { bucketGoals } from "../../labs";
import { LabShell, restore } from "./LabShell";

interface Data {
  capacity: number;
  refillPerSec: number;
}

const INITIAL: Data = { capacity: 3, refillPerSec: 3 };

function Bars({ title, perSecond, total, accepted }: { title: string; perSecond: [number, number][]; total: number; accepted: number }) {
  const max = Math.max(...perSecond.map(([a, r]) => a + r), 1);
  return (
    <figure className="rounded-2xl border border-line bg-surface/50 p-3">
      <figcaption className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold">{title}</span>
        <span className="font-mono text-xs text-ink-quiet">
          {accepted}/{total} served
        </span>
      </figcaption>
      <div className="flex h-28 items-end gap-1.5" role="img" aria-label={`${title}: ${accepted} of ${total} requests served over ten seconds`}>
        {perSecond.map(([a, r], i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end gap-px">
            <motion.span initial={false} animate={{ height: `${(r / max) * 100}%` }} className="w-full rounded-t-sm bg-fail/80" />
            <motion.span initial={false} animate={{ height: `${(a / max) * 100}%` }} className="w-full rounded-b-sm bg-good" />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-quiet">
        <span>0s</span>
        <span>10s</span>
      </div>
    </figure>
  );
}

export function TokenBucketLab({ data, onChange, onDone, done }: { data: unknown; onChange: (d: Data) => void; onDone: () => void; done: boolean }) {
  const d = restore(data, INITIAL, ["capacity", "refillPerSec"]);
  const g = bucketGoals(d);
  const goals = [
    { id: "person", text: "Serve every request from the real person, including the burst of 8 when their app opens.", met: g.personServed },
    { id: "scraper", text: "Reject at least 70% of the scraper's requests.", met: g.scraperBlocked },
  ];
  useEffect(() => {
    if (!done && g.personServed && g.scraperBlocked) onDone();
  });

  return (
    <LabShell goals={goals}>
      <p className="text-sm text-ink-quiet">
        Each client has a bucket of tokens. Every request spends one; the bucket refills at a steady rate up to its capacity. Bursts are fine, floods are not.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span>
            Bucket capacity: <strong className="font-mono">{d.capacity}</strong> tokens
          </span>
          <input type="range" min={1} max={20} value={d.capacity} onChange={(e) => onChange({ ...d, capacity: Number(e.target.value) })} className="accent-[var(--flow)]" />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>
            Refill rate: <strong className="font-mono">{d.refillPerSec}</strong> tokens/second
          </span>
          <input type="range" min={1} max={20} value={d.refillPerSec} onChange={(e) => onChange({ ...d, refillPerSec: Number(e.target.value) })} className="accent-[var(--flow)]" />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Bars title="Real person" perSecond={g.person.perSecond} total={g.person.total} accepted={g.person.accepted} />
        <Bars title="Scraper bot" perSecond={g.scraper.perSecond} total={g.scraper.total} accepted={g.scraper.accepted} />
      </div>
      <p className="flex gap-4 font-mono text-xs text-ink-quiet">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-good" /> served
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-fail/80" /> rejected with HTTP 429
        </span>
      </p>
    </LabShell>
  );
}
