import type { Rift } from "./rift";

/**
 * Content checks a schema can't express: patterns that let a player answer without reading.
 * The schema checks that a level is well-formed; this checks that it is fair.
 */

export interface ChoiceQuestion {
  where: string;
  prompt: string;
  choices: { text: string; correct: boolean }[];
}

export interface QualityIssue {
  levelId: string;
  where: string;
  kind: "length-tell";
  message: string;
}

/** Visible length of an option: Markdown markers don't count. */
export const visibleLength = (text: string) => text.replace(/\*\*|`|\*/g, "").replace(/\s+/g, " ").trim().length;

/**
 * A right answer stands out by length when it is more than 1.25× the longest wrong option. Across a
 * level the right answer should also be the longest option only some of the time (see
 * MAX_LONGEST_SHARE); otherwise "pick the longest" becomes a winning strategy.
 */
export const LENGTH_TELL_RATIO = 1.25;
export const MAX_LONGEST_SHARE = 0.5;

export function lengthRatio(q: ChoiceQuestion): { ratio: number; longest: boolean } {
  const right = q.choices.filter((c) => c.correct).map((c) => visibleLength(c.text));
  const wrong = q.choices.filter((c) => !c.correct).map((c) => visibleLength(c.text));
  if (right.length === 0 || wrong.length === 0) return { ratio: 1, longest: false };
  const best = Math.max(...right);
  return { ratio: best / Math.max(1, Math.max(...wrong)), longest: best > Math.max(...wrong) };
}

/** Every graded multiple-choice question in a rift: refactor steps, boss questions and review cards. */
export function choiceQuestions(rift: Rift): ChoiceQuestion[] {
  const out: ChoiceQuestion[] = [];
  rift.play.forEach((stage, s) => {
    if (stage.kind !== "steps") return;
    stage.steps.forEach((step, i) => out.push({ where: `stage ${s + 1} step ${i + 1}`, prompt: step.prompt, choices: step.options }));
  });
  rift.boss.questions.forEach((q, i) => out.push({ where: `boss question ${i + 1}`, prompt: q.prompt, choices: q.choices }));
  rift.cards.forEach((q, i) => out.push({ where: `card ${i + 1}`, prompt: q.prompt, choices: q.choices }));
  return out;
}

export function findQualityIssues(levelId: string, rift: Rift): QualityIssue[] {
  const issues: QualityIssue[] = [];
  for (const q of choiceQuestions(rift)) {
    const { ratio, longest } = lengthRatio(q);
    if (longest && ratio > LENGTH_TELL_RATIO) {
      issues.push({ levelId, where: q.where, kind: "length-tell", message: `the right answer is ${ratio.toFixed(2)}× the longest wrong one` });
    }
  }
  return issues;
}

/** Share of questions whose right answer is the single longest option. Fair content sits near 1 / options. */
export function longestShare(questions: ChoiceQuestion[]): number {
  if (questions.length === 0) return 0;
  return questions.filter((q) => lengthRatio(q).longest).length / questions.length;
}
