import { ScrollGlowCard } from "@/components/fx/ScrollGlowCard";
import { CityBanner } from "@/components/home/CityBanner";
import { FirstPlan } from "@/components/home/FirstPlan";
import { Hero } from "@/components/home/Hero";
import { WorldMap } from "@/components/home/WorldMap";
import { Workspace } from "@/components/home/Workspace";
import { loadValidContent } from "@/content/load";

const LOOP = [
  { title: "Pain", plain: "watch it break", text: "A badly designed system breaks in a short story.", tone: "var(--fail)" },
  { title: "Play", plain: "fix it", text: "You fix it with your own hands, one move at a time.", tone: "var(--flow)" },
  { title: "Proof", plain: "the interview", text: "A few real interview questions. Get most of them right.", tone: "var(--player)" },
  { title: "Recall", plain: "rebuild it from memory", text: "Two minutes of rebuilding it yourself. This is the part that makes it stick.", tone: "var(--good)" },
];

export default function Home() {
  const { levels, worlds } = loadValidContent();
  const firstHld = levels.find((l) => worlds.find((w) => w.id === l.world)?.track === "hld") ?? levels[0];

  return (
    <main id="main" className="mx-auto flex max-w-7xl flex-col gap-20 px-4 pb-20 sm:px-6">
      {/* Returning learners: their workspace. First visit: the pitch and a plan. Switched by CSS
          before first paint (see globals.css), then kept in step by the workspace. */}
      <div className="home-returning flex-col gap-2">
        <CityBanner />
        <Workspace />
      </div>

      <div className="home-first flex flex-col gap-20">
        <Hero startHref={`/levels/${levels[0].id}/`} hldHref={`/levels/${firstHld.id}/`} levels={levels.length} />
        <FirstPlan />
      </div>

      <section aria-labelledby="loop-heading">
        <ScrollGlowCard>
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_2fr] lg:items-center">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-flow">How every level works</p>
              <h2 id="loop-heading" className="mt-2 font-display text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                Ten minutes. Four beats. One idea you keep.
              </h2>
            </div>
            <ol className="grid gap-6 sm:grid-cols-2">
              {LOOP.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="font-mono text-sm" style={{ color: step.tone }}>
                    0{i + 1}
                  </span>
                  <span>
                    <span className="block font-display text-xl font-semibold">
                      {step.title} <span className="text-sm font-normal text-ink-quiet">· {step.plain}</span>
                    </span>
                    <span className="mt-1 block text-sm text-ink-quiet">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </ScrollGlowCard>
      </section>

      <WorldMap />

      <footer className="flex flex-col gap-2 border-t border-line pt-6 text-sm text-ink-quiet sm:flex-row sm:items-center sm:justify-between">
        <p>Archirift is free and open source. Code under MIT, lessons under CC BY 4.0.</p>
        <p className="flex gap-4">
          <a className="underline hover:text-flow" href="https://github.com/Starlord00788/archirift">
            GitHub
          </a>
          <a className="underline hover:text-flow" href="https://github.com/Starlord00788/archirift/blob/main/CONTRIBUTING.md">
            Write a level
          </a>
        </p>
      </footer>
    </main>
  );
}
