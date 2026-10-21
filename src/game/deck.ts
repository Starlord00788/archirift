/** Review and arena questions, built at build time from level content and passed to the client. */
export interface DeckQuestion {
  prompt: string;
  choices: { text: string; correct: boolean; why: string }[];
}

/** A fill-in-the-blanks recall, typed from memory: the level's own cloze text. */
export interface DeckCloze {
  prompt: string;
  /** Blanks are written [[answer]] or [[answer|alternative]]. */
  text: string;
}

export interface DeckEntry {
  conceptId: string;
  conceptName: string;
  levelId: string;
  levelTitle: string;
  world: string;
  oneLiner: string;
  /** Fresh review cards first, then the boss questions already met in the level. */
  questions: DeckQuestion[];
  cloze?: DeckCloze;
}
