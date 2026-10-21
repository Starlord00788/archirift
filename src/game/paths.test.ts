import { describe, expect, it } from "vitest";
import { buildCatalog } from "@/content/catalog";
import { emptyProgress } from "@/persistence/types";
import { formatMinutes, pathFor, planStatus } from "./paths";

const catalog = buildCatalog();
const ids = new Set(catalog.levels.map((l) => l.id));
const trackOf = (id: string) => catalog.worlds.find((w) => w.id === catalog.levels.find((l) => l.id === id)!.world)!.track;
const at = "2026-10-01T09:00:00.000Z";

describe("learning paths", () => {
  for (const track of ["lld", "hld", "both"] as const) {
    for (const horizon of ["sprint", "month", "open"] as const) {
      it(`${track}/${horizon} uses only real, playable levels of the right track, once each`, () => {
        const path = pathFor({ track, horizon }, catalog);
        expect(path.length).toBeGreaterThan(0);
        expect(new Set(path).size).toBe(path.length);
        for (const id of path) {
          expect(ids.has(id), id).toBe(true);
          expect(catalog.levels.find((l) => l.id === id)!.playable, id).toBe(true);
          if (track !== "both") expect(trackOf(id)).toBe(track);
        }
      });
    }
  }

  it("sprints are short enough to finish in two weeks, and grow with more time", () => {
    for (const track of ["lld", "hld", "both"] as const) {
      const sprint = pathFor({ track, horizon: "sprint" }, catalog).length;
      const month = pathFor({ track, horizon: "month" }, catalog).length;
      const open = pathFor({ track, horizon: "open" }, catalog).length;
      expect(sprint).toBeLessThanOrEqual(24);
      expect(month).toBeGreaterThan(sprint);
      expect(open).toBeGreaterThanOrEqual(month);
    }
  });

  it("keeps course order within a track, and alternates tracks when preparing for both", () => {
    const rank = new Map(catalog.levels.map((l, i) => [l.id, i]));
    const lld = pathFor({ track: "lld", horizon: "month" }, catalog);
    expect(lld.map((id) => rank.get(id)!)).toEqual([...lld.map((id) => rank.get(id)!)].sort((a, b) => a - b));
    const both = pathFor({ track: "both", horizon: "sprint" }, catalog);
    expect(trackOf(both[0])).toBe("lld");
    expect(trackOf(both[1])).toBe("hld");
  });
});

describe("plan status", () => {
  it("is null without a goal", () => {
    expect(planStatus(emptyProgress(at), catalog)).toBeNull();
  });

  it("counts sealed and tested-out levels, and paces what's left over the days remaining", () => {
    const path = pathFor({ track: "hld", horizon: "sprint" }, catalog);
    const progress = { ...emptyProgress(at), goal: { track: "hld" as const, horizon: "sprint" as const, setAt: at }, completedLessons: [path[0]], testedOut: [path[1], path[2]] };
    const status = planStatus(progress, catalog, new Date("2026-10-05T10:00:00.000Z"))!;
    expect(status.done.map((l) => l.id)).toEqual([path[0]]);
    expect(status.skipped.map((l) => l.id)).toEqual([path[1], path[2]]);
    expect(status.remaining).toHaveLength(path.length - 3);
    expect(status.next?.id).toBe(path[3]);
    expect(status.daysLeft).toBe(10);
    expect(status.perDay).toBe(Math.ceil((path.length - 3) / 10));
    expect(status.minutesLeft).toBe(status.remaining.reduce((s, l) => s + l.minutes, 0));
  });

  it("has no pace without a deadline, and none once the deadline has passed", () => {
    const open = { ...emptyProgress(at), goal: { track: "lld" as const, horizon: "open" as const, setAt: at } };
    expect(planStatus(open, catalog)!.perDay).toBeNull();
    const late = { ...emptyProgress(at), goal: { track: "lld" as const, horizon: "sprint" as const, setAt: at } };
    const status = planStatus(late, catalog, new Date("2026-12-01T00:00:00.000Z"))!;
    expect(status.daysLeft).toBe(0);
    expect(status.perDay).toBeNull();
  });

  it("formats time", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(130)).toBe("2 h 10 min");
  });
});
