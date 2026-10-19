/**
 * Seeded pseudo-random numbers (mulberry32). The simulation engine must be deterministic:
 * the same seed and configuration always produce the same run (PRD: Simulation and validation model).
 */
export type Random = () => number;

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Number of arrivals in one interval for a Poisson process with the given mean (Knuth's method). */
export function poisson(random: Random, mean: number): number {
  if (mean <= 0) return 0;
  // Knuth's method underflows for large means; a normal approximation is accurate enough there.
  if (mean > 500) {
    const u = Math.max(random(), Number.EPSILON);
    const v = random();
    const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(0, Math.round(mean + Math.sqrt(mean) * normal));
  }
  const limit = Math.exp(-mean);
  let count = 0;
  let product = random();
  while (product > limit) {
    count += 1;
    product *= random();
  }
  return count;
}
