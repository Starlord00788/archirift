"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { GraphView } from "@/components/GraphView";
import { classOffers, generateCode, type Language } from "../codegen";
import { hydraHeads, type Design } from "../design";
import { OFFERS } from "../domain";
import type { Beat } from "../level";
import { designToView } from "./blueprint";
import { Hydra } from "./Hydra";

type Lens = "story" | "blueprint" | "code";
const LENSES: { id: Lens; label: string }[] = [
  { id: "story", label: "Story" },
  { id: "blueprint", label: "Blueprint" },
  { id: "code", label: "Code" },
];

const STORY: Record<Beat, string> = {
  pain: "Meera, owner of Brew & Bytes: “Festival week starts Monday. ₹80 off orders over ₹300. Just add it to the bill, please?”",
  play: "Meera: “Every time we touch that billing code, something else breaks. Can you make it stop?”",
  proof: "Meera: “It's raining, the office crowd wants a combo, and new customers are walking in. More offers, quick!”",
  recall: "The blueprint has been rolled up. Rebuild it from memory before you look again.",
  reward: "Meera: “Three new offers this week and not a single wrong bill. Thank you, architect.”",
};

/** Story, Blueprint and Code views of the same design, always in sync (PRD: Three Lenses). */
export function Lenses({ design, beat }: { design: Design; beat: Beat }) {
  const [lens, setLens] = useState<Lens>("story");
  const [language, setLanguage] = useState<Language>("ts");
  const base = useId();

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    const next = LENSES[(index + delta + LENSES.length) % LENSES.length].id;
    setLens(next);
    document.getElementById(`${base}-tab-${next}`)?.focus();
  };

  const inline = design.injected ? [] : design.chain.filter((e) => !e.extracted).map((e) => `if ${OFFERS[e.offer].label.toLowerCase()}`);
  const view = designToView(design);

  return (
    <section className="flex flex-col gap-3">
      <div role="tablist" aria-label="Lens" className="flex gap-1 rounded-lg border border-line bg-surface p-1">
        {LENSES.map((l, i) => (
          <button
            key={l.id}
            id={`${base}-tab-${l.id}`}
            role="tab"
            type="button"
            aria-selected={lens === l.id}
            aria-controls={`${base}-panel`}
            tabIndex={lens === l.id ? 0 : -1}
            onClick={() => setLens(l.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm ${lens === l.id ? "bg-bg font-semibold text-flow" : "text-ink-quiet hover:text-ink"}`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${lens}`} className="min-h-80">
        {lens === "story" && (
          <div className="flex flex-col items-center gap-3">
            <p className="w-full rounded-lg border border-line bg-surface p-3 text-sm">{STORY[beat]}</p>
            <Hydra
              heads={inline}
              defeated={hydraHeads(design) === 0 && design.injected}
              classes={classOffers(design).map((id) => OFFERS[id].className)}
            />
          </div>
        )}
        {lens === "blueprint" && <GraphView nodes={view.nodes} edges={view.edges} label="your current design" />}
        {lens === "code" && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 text-xs" role="group" aria-label="Language">
              {(["ts", "java"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={language === l}
                  onClick={() => setLanguage(l)}
                  className={`rounded border px-2 py-1 ${language === l ? "border-flow text-flow" : "border-line text-ink-quiet"}`}
                >
                  {l === "ts" ? "TypeScript" : "Java"}
                </button>
              ))}
            </div>
            <pre className="max-h-105 overflow-auto rounded-lg border border-line bg-surface p-3 font-mono text-xs leading-relaxed">
              <code>{generateCode(design, language)}</code>
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
