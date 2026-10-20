import Link from "next/link";
import { loadValidContent } from "@/content/load";
import { ContinueCard } from "@/components/ContinueCard";
import { LevelBadge } from "@/components/LevelBadge";

export default function Home() {
  const { levels } = loadValidContent();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-4">
        <p className="font-mono text-sm text-flow">Build it. Break it. Scale it.</p>
        <h1 className="font-display text-5xl font-semibold tracking-tight">Archirift</h1>
        <p className="max-w-xl text-lg text-ink-quiet">
          Every badly designed system tears a rift in the city. Learn low-level and high-level design by
          watching systems break, fixing them with your own hands, and proving it in interview boss fights.
        </p>
      </header>

      <ContinueCard levels={levels.map(({ id, title }) => ({ id, title }))} />

      <section aria-labelledby="levels-heading" className="flex flex-col gap-3">
        <h2 id="levels-heading" className="font-display text-xl font-semibold">
          Levels
        </h2>
        <ul className="flex flex-col gap-3">
          {levels.map((level) => (
            <li key={level.id}>
              <Link
                href={`/levels/${level.id}/`}
                className="block rounded-lg border border-line bg-surface p-4 transition-colors hover:border-flow focus-visible:border-flow focus-visible:outline-none"
              >
                <span className="font-display text-lg font-semibold">{level.title}</span>
                <LevelBadge levelId={level.id} />
                <span className="mt-1 block text-sm text-ink-quiet">{level.summary}</span>
                <span className="mt-2 block font-mono text-xs text-ink-quiet">About {level.minutes} minutes</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-sm text-ink-quiet">
        Milestone 0 preview. Open-source on{" "}
        <a className="underline hover:text-flow" href="https://github.com/Starlord00788/archirift">
          GitHub
        </a>
        .
      </footer>
    </main>
  );
}
