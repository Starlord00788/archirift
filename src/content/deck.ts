import type { DeckEntry } from "@/game/deck";
import { ELABORATION_QUESTION, INTERVIEW_QUESTION } from "@/levels/hydra/level";
import { loadValidContent } from "./load";

/** Every concept's review questions: the level's boss questions plus its extra cards. Build time only. */
export function buildDeck(): DeckEntry[] {
  const { levels, concepts } = loadValidContent();
  const names = new Map(concepts.map((c) => [c.id, c.name]));
  return levels.map((level) => {
    const conceptId = level.concepts[0];
    const questions = level.rift
      ? [...level.rift.boss.questions, ...level.rift.cards]
      : [INTERVIEW_QUESTION, ELABORATION_QUESTION].map((q) => ({ prompt: q.prompt, choices: q.choices.map(({ text, correct, why }) => ({ text, correct, why })) }));
    return {
      conceptId,
      conceptName: names.get(conceptId) ?? level.title,
      levelId: level.id,
      levelTitle: level.title,
      world: level.world,
      oneLiner: level.rift?.codex.oneLiner ?? concepts.find((c) => c.id === conceptId)?.rule ?? level.summary,
      questions,
    };
  });
}
