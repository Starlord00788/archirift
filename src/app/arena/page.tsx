import type { Metadata } from "next";
import { BossRush } from "@/components/arena/BossRush";
import { buildDeck } from "@/content/deck";

export const metadata: Metadata = { title: "Arena", description: "Boss Rush: rapid-fire system design interview questions from every district." };

export default function ArenaPage() {
  return (
    <main id="main" className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-pink">Interview prep</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">The Arena</h1>
        <p className="mt-2 max-w-2xl text-ink-quiet">Ten interview questions, against the clock. It&apos;s the closest thing to the real round: trade-offs, not definitions.</p>
      </header>
      <BossRush deck={buildDeck()} />
    </main>
  );
}
