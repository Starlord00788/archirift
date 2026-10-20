import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadValidContent } from "@/content/load";
import { HydraLevel } from "@/levels/hydra/ui/HydraLevel";
import { LEVEL_ID as HYDRA_ID } from "@/levels/hydra/level";

export const dynamicParams = false;

export function generateStaticParams() {
  return loadValidContent().levels.map((level) => ({ id: level.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const level = loadValidContent().levels.find((l) => l.id === id);
  return level ? { title: level.title, description: level.summary } : {};
}

/** Playable levels by id. Levels without an entry show their briefing only. */
const PLAYABLE: Record<string, () => React.ReactNode> = {
  [HYDRA_ID]: () => <HydraLevel />,
};

export default async function LevelPage({ params }: Props) {
  const { id } = await params;
  const { levels } = loadValidContent();
  const level = levels.find((l) => l.id === id);
  if (!level) notFound();

  const Playable = PLAYABLE[level.id];
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Link href="/" className="font-mono text-sm text-ink-quiet hover:text-flow">
        ← Back to the city
      </Link>
      {Playable ? (
        <Playable />
      ) : (
        <>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{level.title}</h1>
          <p className="text-lg text-ink-quiet">{level.summary}</p>
          <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-quiet">This level is not playable yet.</p>
        </>
      )}
    </main>
  );
}
