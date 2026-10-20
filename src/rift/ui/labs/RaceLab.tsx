"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { RACE_USERS, initialRace, raceCanStep, raceDoubleBooked, raceFinished, raceProgram, raceStep, type RaceOp, type RaceState } from "../../labs";
import { LabShell, restore } from "./LabShell";

interface Data {
  race: RaceState;
  goals: { doubleBooked: boolean; safe: boolean };
}

const INITIAL: Data = { race: initialRace(false), goals: { doubleBooked: false, safe: false } };

const OP_TEXT: Record<RaceOp, string> = {
  lock: "lock(seat7)",
  read: "s = db.read(seat7)",
  check: "if (s != free) return SOLD_OUT",
  write: "db.write(seat7, me); emailTicket()",
  unlock: "unlock(seat7)",
};

export function RaceLab({ data, onChange, onDone, done }: { data: unknown; onChange: (d: Data) => void; onDone: () => void; done: boolean }) {
  const d = restore(data, INITIAL, ["race", "goals"]);
  const { race } = d;
  const program = raceProgram(race.locking);
  const finished = raceFinished(race);
  const goals = [
    { id: "double", text: "No lock: schedule the two threads so both Alice and Bob get a ticket for seat 7.", met: d.goals.doubleBooked },
    { id: "safe", text: "Add the lock, then try any order you like. Finish both threads with exactly one ticket sold.", met: d.goals.safe },
  ];
  useEffect(() => {
    if (!done && d.goals.doubleBooked && d.goals.safe) onDone();
  });

  const step = (t: 0 | 1) => {
    const next = raceStep(race, t);
    const end = raceFinished(next);
    onChange({
      race: next,
      goals: {
        doubleBooked: d.goals.doubleBooked || (!next.locking && end && raceDoubleBooked(next)),
        safe: d.goals.safe || (next.locking && end && !raceDoubleBooked(next)),
      },
    });
  };
  const reset = (locking: boolean) => onChange({ ...d, race: initialRace(locking) });

  return (
    <LabShell goals={goals}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={race.locking ? "primary" : "secondary"} onClick={() => reset(!race.locking)}>
          {race.locking ? "Lock is on: remove it" : "Add a lock around read-check-write"}
        </Button>
        <Button variant="ghost" onClick={() => reset(race.locking)}>
          Reset
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_180px_1fr]">
        {([0, 1] as const).map((t) => (
          <section key={t} className={`rounded-2xl border p-3 ${t === 1 ? "md:order-3" : ""} ${race.holder === t ? "border-flow" : "border-line"} bg-surface/50`} aria-label={`${RACE_USERS[t]}'s thread`}>
            <h4 className="mb-2 flex items-center justify-between font-display font-semibold">
              {RACE_USERS[t]}&apos;s request
              {race.holder === t && <span className="rounded-full bg-flow px-2 font-mono text-[10px] text-bg">holds lock</span>}
            </h4>
            <ol className="flex flex-col gap-1 font-mono text-[11.5px]">
              {program.map((op, i) => (
                <li key={op} className={`rounded-md px-2 py-1 ${i < race.pc[t] ? "text-ink-quiet line-through" : i === race.pc[t] ? "bg-flow/15 text-flow" : "text-ink-quiet/70"}`}>
                  {OP_TEXT[op]}
                </li>
              ))}
            </ol>
            <Button className="mt-3 w-full" disabled={!raceCanStep(race, t)} onClick={() => step(t)}>
              {race.pc[t] >= program.length ? "Finished" : !raceCanStep(race, t) ? "Waiting for the lock…" : `Run ${RACE_USERS[t]}'s next step`}
            </Button>
          </section>
        ))}
        <section className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-bg/40 p-3 text-center md:order-2" aria-label="Shared database">
          <span className="font-mono text-[10px] text-ink-quiet">database</span>
          <motion.span key={race.seat ?? "free"} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className={`rounded-xl border-2 px-4 py-3 font-display text-lg font-bold ${race.seat ? "border-warn text-warn" : "border-good text-good"}`}>
            Seat 7: {race.seat ?? "free"}
          </motion.span>
          <span className="text-xs text-ink-quiet">tickets emailed:</span>
          <span className={`font-mono text-sm ${race.confirmations.length > 1 ? "text-fail" : ""}`}>{race.confirmations.length ? race.confirmations.join(", ") : "none"}</span>
        </section>
      </div>

      {finished && (
        <p role="status" className={`rounded-xl border p-3 text-sm ${raceDoubleBooked(race) ? "border-fail bg-fail/5" : "border-good bg-good/5"}`}>
          {raceDoubleBooked(race)
            ? "Double-booked! Both threads read “free” before either wrote. That's a race condition: check-then-act without mutual exclusion."
            : race.locking
              ? "One ticket, no matter the order. The lock made read-check-write atomic."
              : "Only one ticket this time. Try a different interleaving: read, read, then write, write."}
        </p>
      )}

      <ol className="max-h-36 overflow-auto rounded-xl border border-line bg-bg/40 p-2 font-mono text-[11px] text-ink-quiet" aria-label="What happened">
        {race.log.length === 0 ? <li>Nothing has run yet.</li> : race.log.map((line, i) => <li key={i}>{i + 1}. {line}</li>)}
      </ol>
    </LabShell>
  );
}
