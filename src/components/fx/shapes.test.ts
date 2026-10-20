import { describe, expect, it } from "vitest";
import { buildClouds, SHAPES } from "./shapes";

describe("hero point clouds", () => {
  it("gives every shape the same number of points, all finite and inside the frame", () => {
    for (const n of [1200, 5200]) {
      const clouds = buildClouds(n);
      expect(clouds).toHaveLength(SHAPES.length);
      for (const cloud of clouds) {
        expect(cloud.xyz.length).toBe(n * 3);
        expect(cloud.hue.length).toBe(n);
        expect(cloud.xyz.every((v) => Number.isFinite(v) && Math.abs(v) < 2.2)).toBe(true);
        expect(cloud.hue.every((h) => h >= 0 && h <= 1)).toBe(true);
      }
    }
  });

  it("is deterministic, so the scene looks the same on every visit", () => {
    expect(Array.from(buildClouds(800)[1].xyz.slice(0, 30))).toEqual(Array.from(buildClouds(800)[1].xyz.slice(0, 30)));
  });
});
