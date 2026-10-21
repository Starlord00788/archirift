/**
 * The skip test: a short check that lets someone who already knows a district's ideas take its
 * levels off their path. One question from each of up to six levels spread across the district;
 * passing needs all but one right, so guessing almost never gets through (about 1% with three
 * choices). Passing marks the levels "tested out", never "sealed".
 */
export interface DiagnosticQuestion {
  levelId: string;
  levelTitle: string;
  conceptId: string;
  prompt: string;
  choices: { text: string; correct: boolean }[];
}

export interface Diagnostic {
  worldId: string;
  worldName: string;
  /** Every level in the district, in course order: the ones a pass takes off the path. */
  levelIds: string[];
  questions: DiagnosticQuestion[];
}

export const MAX_QUESTIONS = 6;

/** Up to `max` items spread evenly from first to last, so the check covers the whole district. */
export function spread<T>(items: T[], max = MAX_QUESTIONS): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.round((i * (items.length - 1)) / (max - 1))]);
}

/** Right answers needed to pass: all but one, or all of them for a very short check. */
export function passMark(total: number): number {
  return total <= 3 ? total : total - 1;
}

export interface DiagnosticResult {
  correct: number;
  total: number;
  passed: boolean;
  /** Levels whose question was missed: where to start instead. */
  missed: string[];
}

export function scoreDiagnostic(diagnostic: Diagnostic, answers: number[]): DiagnosticResult {
  const results = diagnostic.questions.map((q, i) => q.choices[answers[i]]?.correct === true);
  const correct = results.filter(Boolean).length;
  const total = diagnostic.questions.length;
  return { correct, total, passed: total > 0 && correct >= passMark(total), missed: diagnostic.questions.filter((_, i) => !results[i]).map((q) => q.levelId) };
}
