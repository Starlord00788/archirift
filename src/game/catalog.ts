/**
 * A light, serialisable index of worlds and levels that the server passes to client components
 * (the header, the map, achievements), so they never need to load full level content.
 */
export interface CatalogLevel {
  id: string;
  title: string;
  summary: string;
  world: string;
  order: number;
  difficulty: number;
  minutes: number;
  /** The concept whose memory schedule this level drives. */
  concept: string;
  conceptName: string;
  playable: boolean;
}

export interface CatalogWorld {
  id: string;
  name: string;
  track: "lld" | "hld";
  order: number;
  tagline: string;
  description: string;
  accent: "flow" | "player" | "warn" | "good" | "pink" | "lime";
}

export interface Catalog {
  worlds: CatalogWorld[];
  levels: CatalogLevel[];
}
