/** Career ranks earned with XP (PRD: Rewards). Thresholds grow so the last ranks need most of the city. */
export const RANKS = [
  { xp: 0, name: "Intern", tagline: "Fresh badge, big dreams" },
  { xp: 300, name: "Junior Engineer", tagline: "Shipping your first fixes" },
  { xp: 900, name: "Software Engineer", tagline: "Trusted with real features" },
  { xp: 2000, name: "Senior Engineer", tagline: "You see the smells before they spread" },
  { xp: 3800, name: "Tech Lead", tagline: "Designs that a team can grow" },
  { xp: 6500, name: "Staff Engineer", tagline: "Systems across teams" },
  { xp: 10000, name: "Principal Engineer", tagline: "The person interviews are scared of" },
  { xp: 15000, name: "Chief Architect", tagline: "The city runs on your blueprints" },
] as const;

export function rankFor(xp: number) {
  let index = 0;
  for (let i = 0; i < RANKS.length; i += 1) if (xp >= RANKS[i].xp) index = i;
  const rank = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  const progress = next ? (xp - rank.xp) / (next.xp - rank.xp) : 1;
  return { index, rank, next, progress, toNext: next ? next.xp - xp : 0 };
}

/** XP for a review answered in the queue. */
export const REVIEW_XP = { correct: 12, wrong: 4 };
