import { describe, expect, it } from "vitest";
import { loadValidContent } from "@/content/load";
import { districtAt, layoutCity, project, unproject } from "./cityLayout";

const { worlds, levels } = loadValidContent();
const city = layoutCity(worlds, levels);

describe("the city map layout", () => {
  it("gives every level exactly one building inside its own district", () => {
    expect(city.buildings).toHaveLength(levels.length);
    expect(new Set(city.buildings.map((b) => b.levelId)).size).toBe(levels.length);
    for (const b of city.buildings) {
      const d = city.districts.find((x) => x.id === b.worldId)!;
      expect(b.x).toBeGreaterThanOrEqual(d.x);
      expect(b.y).toBeGreaterThanOrEqual(d.y);
      expect(b.x + b.w).toBeLessThanOrEqual(d.x + d.w);
      expect(b.y + b.d).toBeLessThanOrEqual(d.y + d.d);
      expect(b.h).toBeGreaterThan(0);
    }
  });

  it("never overlaps two districts, and keeps the two tracks apart", () => {
    expect(city.districts).toHaveLength(worlds.length);
    for (const a of city.districts) {
      for (const b of city.districts) {
        if (a === b) continue;
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y;
        expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
    const lldRight = Math.max(...city.districts.filter((d) => d.track === "lld").map((d) => d.x + d.w));
    const hldLeft = Math.min(...city.districts.filter((d) => d.track === "hld").map((d) => d.x));
    expect(hldLeft).toBeGreaterThan(lldRight);
  });

  it("finds the district under a point on the ground after projecting there and back", () => {
    for (const d of city.districts) {
      const [X, Y] = project(d.x + d.w / 2, d.y + d.d / 2, 0);
      const [x, y] = unproject(X, Y);
      expect(districtAt(city, x, y)?.id).toBe(d.id);
      expect(districtAt(city, x, y, d.track === "lld" ? "hld" : "lld")).toBeUndefined();
    }
  });
});
