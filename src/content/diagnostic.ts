import { spread, type Diagnostic } from "@/game/diagnostic";
import { INTERVIEW_QUESTION } from "@/levels/hydra/level";
import { loadValidContent } from "./load";

/**
 * A district's skip test, built from its own content: each sampled level contributes its first
 * interview-boss question (the hand-built Hydra contributes its interview question). Build time only.
 */
export function buildDiagnostic(worldId: string): Diagnostic | null {
  const { worlds, levels } = loadValidContent();
  const world = worlds.find((w) => w.id === worldId);
  if (!world) return null;
  const own = levels.filter((l) => l.world === worldId);
  const askable = own.filter((l) => l.rift || l.id === "lld-strategy-hydra");
  const questions = spread(askable).map((level) => {
    const q = level.rift ? level.rift.boss.questions[0] : INTERVIEW_QUESTION;
    return {
      levelId: level.id,
      levelTitle: level.title,
      conceptId: level.concepts[0],
      prompt: q.prompt,
      choices: q.choices.map((c) => ({ text: c.text, correct: c.correct })),
    };
  });
  return { worldId, worldName: world.name, levelIds: own.map((l) => l.id), questions };
}
