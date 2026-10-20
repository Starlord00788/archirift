import type { Metadata } from "next";
import { ReviewSession } from "@/components/review/ReviewSession";
import { buildDeck } from "@/content/deck";
import { KineticText } from "@/components/fx/KineticText";

export const metadata: Metadata = { title: "Review", description: "Spaced review of every concept you've learned, scheduled by FSRS." };

export default function ReviewPage() {
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-pink">Memory</p>
        <h1 className="font-display text-4xl font-bold tracking-tight"><KineticText segments={[{ text: "Review" }]} /></h1>
        <p className="mt-2 max-w-2xl text-ink-quiet">Learning is getting it in. Remembering is getting it out. A few minutes here each day keeps every pattern ready for interviews.</p>
      </header>
      <ReviewSession deck={buildDeck()} />
    </main>
  );
}
