import { describe, expect, it } from "vitest";
import { applyEvent } from "./progress";
import { emptyProgress, normaliseProgress, type LearningEvent, type Progress } from "./types";

const at = (d: number) => `2026-10-${String(d).padStart(2, "0")}T09:00:00.000Z`;

describe("plans and skip tests in progress", () => {
  it("keeps the most recent plan", () => {
    let p = emptyProgress(at(1));
    p = applyEvent(p, { id: "goal:1", type: "goalSet", track: "lld", horizon: "sprint", at: at(1) });
    p = applyEvent(p, { id: "goal:2", type: "goalSet", track: "both", horizon: "month", at: at(3) });
    expect(p.goal).toEqual({ track: "both", horizon: "month", setAt: at(3) });
  });

  it("adds tested-out levels once, without marking them sealed or counting a study day", () => {
    let p = emptyProgress(at(1));
    const event: LearningEvent = { id: "t1", type: "levelsTestedOut", worldId: "objects", levelIds: ["a", "b"], correct: 6, total: 6, at: at(2) };
    p = applyEvent(p, event);
    p = applyEvent(p, { ...event, id: "t2", levelIds: ["b", "c"] });
    expect(p.testedOut).toEqual(["a", "b", "c"]);
    expect(p.completedLessons).toEqual([]);
    expect(p.activeDays).toEqual([]);
  });

  it("ignores events from a newer version of the app instead of breaking", () => {
    const p = emptyProgress(at(1));
    const future = { id: "x", type: "somethingNew", at: at(2) } as unknown as LearningEvent;
    expect(applyEvent(p, future)).toEqual(p);
  });

  it("fills the new fields for progress saved before they existed", () => {
    const old = { ...emptyProgress(at(1)) } as Partial<Progress>;
    delete old.goal;
    delete old.testedOut;
    const p = normaliseProgress(old as Progress);
    expect(p.goal).toBeNull();
    expect(p.testedOut).toEqual([]);
  });
});
