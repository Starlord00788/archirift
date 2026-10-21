import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadValidContent } from "@/content/load";
import { createRiftCodec, createRiftReducer, initialRiftState } from "./state";
import { runCodeTests } from "./code";
import { simulate, waveTimeline } from "./sim";

const { levels } = loadValidContent(path.join(process.cwd(), "content"));
const rifts = levels.filter((l) => l.rift);

describe("every simulation in the content is a fair puzzle", () => {
  for (const level of rifts) {
    level.rift!.play.forEach((stage, s) => {
      if (stage.kind !== "sim") return;
      it(`${level.id} stage ${s + 1}: the stored solution survives every wave, and the starting setup does not`, () => {
        const { sim } = stage;
        for (const wave of sim.waves) {
          const result = simulate(sim.solution, wave, sim.goals);
          expect({ wave: wave.name, passed: result.passed, findings: result.findings }).toEqual({ wave: wave.name, passed: true, findings: expect.any(Array) });
        }
        const startPasses = sim.waves.every((wave) => simulate(sim.start, wave, sim.goals).passed);
        expect(startPasses).toBe(false);
      });
      it(`${level.id} stage ${s + 1}: the live playback ends on exactly the wave the game judges`, () => {
        const { sim } = stage;
        for (const wave of sim.waves) {
          const frames = waveTimeline(wave);
          expect(frames.at(-1)!.wave).toEqual(wave);
          expect(simulate(sim.solution, frames.at(-1)!.wave, sim.goals).passed).toBe(true);
        }
      });
    });
  }
});

describe("every code stage is a fair puzzle", () => {
  for (const level of rifts) {
    level.rift!.play.forEach((stage, s) => {
      if (stage.kind !== "code") return;
      it(`${level.id} stage ${s + 1}: the reference solution passes every test, and the starter code does not`, () => {
        const solved = runCodeTests(stage.given, stage.solution, stage.tests);
        expect(solved.filter((r) => !r.passed)).toEqual([]);
        expect(runCodeTests(stage.given, stage.starter, stage.tests).every((r) => r.passed)).toBe(false);
      });
    });
  }
});

describe("every rift can be restored from its own initial state", () => {
  for (const level of rifts) {
    it(`${level.id}`, () => {
      const rift = level.rift!;
      const state = initialRiftState(level.id, rift, "2026-01-01T00:00:00Z");
      expect(createRiftCodec(rift).migrate(JSON.parse(JSON.stringify(state)), 1)).toEqual(state);
      // Pain options always lead somewhere, and Play can't be entered before trying one.
      const reduce = createRiftReducer(level.id, rift);
      expect(reduce(state, { type: "toPlay" }).beat).toBe("pain");
      expect(reduce(reduce(state, { type: "painTry", option: 0 }), { type: "toPlay" }).beat).toBe("play");
    });
  }
});
