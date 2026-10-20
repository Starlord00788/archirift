/** Review and arena questions, built at build time from level content and passed to the client. */
export interface DeckQuestion {
  prompt: string;
  choices: { text: string; correct: boolean; why: string }[];
}

export interface DeckEntry {
  conceptId: string;
  conceptName: string;
  levelId: string;
  levelTitle: string;
  world: string;
  oneLiner: string;
  questions: DeckQuestion[];
}
