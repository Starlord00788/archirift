import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CodexCard } from "@/components/CodexCard";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { loadValidContent } from "@/content/load";

export const dynamicParams = false;

export function generateStaticParams() {
  return loadValidContent()
    .levels.filter((l) => l.rift)
    .map((l) => ({ id: l.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { levels, concepts } = loadValidContent();
  const level = levels.find((l) => l.id === id);
  const name = concepts.find((c) => c.id === level?.concepts[0])?.name;
  return level ? { title: `${name ?? level.title} cheat sheet`, description: level.rift?.codex.oneLiner } : {};
}

export default async function CodexEntryPage({ params }: Props) {
  const { id } = await params;
  const { levels, concepts, worlds, edges } = loadValidContent();
  const level = levels.find((l) => l.id === id);
  if (!level?.rift) notFound();
  const concept = concepts.find((c) => c.id === level.concepts[0]);
  const world = worlds.find((w) => w.id === level.world);
  const related = edges
    .filter((e) => e.from === concept?.id || e.to === concept?.id)
    .map((e) => {
      const other = e.from === concept?.id ? e.to : e.from;
      const otherLevel = levels.find((l) => l.concepts[0] === other && l.rift);
      return { e, other: concepts.find((c) => c.id === other), otherLevel };
    });

  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Link href="/codex/" className="flex w-fit items-center gap-1 font-mono text-xs text-ink-quiet hover:text-flow">
        <Icon name="arrowLeft" size={13} /> The Codex
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest" style={{ color: `var(--${world?.accent ?? "flow"})` }}>
            {world?.name}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight">{concept?.name ?? level.title}</h1>
        </div>
        <ButtonLink href={`/levels/${level.id}/`} variant="primary">
          <Icon name="play" size={14} filled /> Play “{level.title}”
        </ButtonLink>
      </header>
      <CodexCard name={concept?.name ?? level.title} codex={level.rift.codex} />
      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="rounded-2xl border border-line bg-surface/60 p-5">
          <h2 id="related-heading" className="mb-3 font-display text-xl font-semibold">
            Connected ideas
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {related.map(({ e, other, otherLevel }) => (
              <li key={`${e.from}-${e.to}`}>
                <span className="font-mono text-xs text-player">{e.type}</span>{" "}
                {otherLevel ? (
                  <Link href={`/codex/${otherLevel.id}/`} className="font-semibold hover:text-flow">
                    {other?.name}
                  </Link>
                ) : (
                  <span className="font-semibold">{other?.name}</span>
                )}
                : <span className="text-ink-quiet">{e.explanation}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
