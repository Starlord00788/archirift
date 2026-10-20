import type { Catalog } from "@/game/catalog";
import { loadValidContent } from "./load";

/** Builds the light catalog the client shell uses. Build time only. */
export function buildCatalog(): Catalog {
  const { worlds, levels, concepts } = loadValidContent();
  const names = new Map(concepts.map((c) => [c.id, c.name]));
  return {
    worlds: worlds.map(({ id, name, track, order, tagline, description, accent }) => ({ id, name, track, order, tagline, description, accent })),
    levels: levels.map((l) => ({
      id: l.id,
      title: l.title,
      summary: l.summary,
      world: l.world,
      order: l.order,
      difficulty: l.difficulty,
      minutes: l.minutes,
      concept: l.concepts[0],
      conceptName: names.get(l.concepts[0]) ?? l.concepts[0],
      playable: Boolean(l.rift) || l.bespoke,
    })),
  };
}
