import { describe, expect, it } from "vitest";
import { createRandom, poisson } from "./random";

describe("createRandom", () => {
  it("replays the same sequence for the same seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const first = Array.from({ length: 100 }, a);
    const second = Array.from({ length: 100 }, b);
    expect(first).toEqual(second);
  });

  it("gives different sequences for different seeds", () => {
    expect(createRandom(1)()).not.toEqual(createRandom(2)());
  });

  it("stays within [0, 1)", () => {
    const random = createRandom(7);
    for (let i = 0; i < 10_000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("poisson", () => {
  it.each([3, 50, 900])("averages close to a mean of %d", (mean) => {
    const random = createRandom(123);
    const samples = 5_000;
    let total = 0;
    for (let i = 0; i < samples; i += 1) total += poisson(random, mean);
    expect(total / samples).toBeGreaterThan(mean * 0.95);
    expect(total / samples).toBeLessThan(mean * 1.05);
  });

  it("returns 0 for a non-positive mean", () => {
    expect(poisson(createRandom(1), 0)).toBe(0);
  });
});
