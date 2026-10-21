/**
 * The city map as geometry. Every district is a block of lots and every level is one building on
 * it, so the skyline is a picture of your progress: finished levels stand lit, the rest are still
 * blueprints. Units are "lots"; x runs down-right and y down-left on screen (isometric).
 */
export interface CityDistrict {
  id: string;
  track: "lld" | "hld";
  accent: string;
  name: string;
  x: number;
  y: number;
  w: number;
  d: number;
}

export interface CityBuilding {
  levelId: string;
  worldId: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  seed: number;
}

export interface CityRoad {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** The wide road between the two halves of the city. */
  highway?: boolean;
}

export interface CityLayout {
  districts: CityDistrict[];
  buildings: CityBuilding[];
  roads: CityRoad[];
}

interface WorldInput {
  id: string;
  track: "lld" | "hld";
  accent: string;
  name: string;
}

interface LevelInput {
  id: string;
  world: string;
  difficulty: number;
}

const LOTS_ACROSS = 4;
/** Step between neighbouring districts along the screen's horizontal (applied as +x and -y). */
const STEP = 5.1;
/** How far the front row sits in front of the back row (applied as +x and +y). */
const ROW = 5.2;
/** Extra room for the highway between the two halves of the city. */
const HIGHWAY = 2;
const FOOTPRINT = 0.64;
const RING = 0.65;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * Districts sit in two staggered rows that run across the screen, so the city reads left to right
 * like the tiles below it, and the camera pans sideways from one track to the other.
 */
export function layoutCity(worlds: WorldInput[], levels: LevelInput[]): CityLayout {
  const districts: CityDistrict[] = [];
  const buildings: CityBuilding[] = [];
  const roads: CityRoad[] = [];
  const rowOf = new Map<string, number>();
  let along = 0;

  (["lld", "hld"] as const).forEach((track, t) => {
    const own = worlds.filter((w) => w.track === track);
    if (own.length === 0) return;
    const back = Math.ceil(own.length / 2);
    own.forEach((world, i) => {
      const row = i < back ? 0 : 1;
      // The front row staggers half a block right in the first half of the city and half a block
      // left in the second, so both halves lean in towards the highway instead of leaving a hole.
      const col = row === 0 ? i : i - back + (t % 2 === 0 ? 0.5 : -0.5);
      const step = along + col * STEP;
      const x = step + row * ROW;
      const y = -step + row * ROW;
      const mine = levels.filter((l) => l.world === world.id);
      const d = Math.max(1, Math.ceil(mine.length / LOTS_ACROSS));
      districts.push({ id: world.id, track, accent: world.accent, name: world.name, x, y, w: LOTS_ACROSS, d });
      rowOf.set(world.id, row);
      mine.forEach((level, k) => {
        const seed = hash(level.id);
        const inset = (1 - FOOTPRINT) / 2;
        buildings.push({
          levelId: level.id,
          worldId: world.id,
          x: x + (k % LOTS_ACROSS) + inset,
          y: y + Math.floor(k / LOTS_ACROSS) + inset,
          w: FOOTPRINT,
          d: FOOTPRINT,
          // Harder levels stand taller; a little noise keeps the skyline from looking stamped.
          h: 0.55 + level.difficulty * 0.55 + seed * 0.7,
          seed,
        });
      });
      // A ring road around every block.
      const x0 = x - RING;
      const y0 = y - RING;
      const x1 = x + LOTS_ACROSS + RING;
      const y1 = y + d + RING;
      roads.push({ x1: x0, y1: y0, x2: x1, y2: y0 }, { x1: x1, y1: y0, x2: x1, y2: y1 }, { x1: x1, y1: y1, x2: x0, y2: y1 }, { x1: x0, y1: y1, x2: x0, y2: y0 });
    });
    along += back * STEP + HIGHWAY;
  });

  roads.push(...highway(districts, rowOf));
  return { districts, buildings, roads };
}

/** Screen extent of one district's ground plate. */
function plate(d: CityDistrict) {
  const pts = [
    project(d.x, d.y, 0),
    project(d.x + d.w, d.y, 0),
    project(d.x, d.y + d.d, 0),
    project(d.x + d.w, d.y + d.d, 0),
  ];
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    maxX: Math.max(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}

/**
 * The highway between the two tracks: it runs down the screen through the gap in the back row,
 * then the gap in the front row, so the space between the halves reads as a road, not a hole.
 */
function highway(districts: CityDistrict[], rowOf: Map<string, number>): CityRoad[] {
  const gap = (row: number) => {
    const lld = districts.filter((d) => d.track === "lld" && rowOf.get(d.id) === row).map(plate);
    const hld = districts.filter((d) => d.track === "hld" && rowOf.get(d.id) === row).map(plate);
    if (!lld.length || !hld.length) return undefined;
    const all = [...lld, ...hld];
    return {
      X: (Math.max(...lld.map((p) => p.maxX)) + Math.min(...hld.map((p) => p.minX))) / 2,
      top: Math.min(...all.map((p) => p.minY)),
      bottom: Math.max(...all.map((p) => p.maxY)),
    };
  };
  const back = gap(0);
  if (!back) return [];
  const front = gap(1) ?? back;
  const points: [number, number][] = [
    [back.X, back.top - 1.2],
    [back.X, (back.top + back.bottom) / 2],
    [front.X, (front.top + front.bottom) / 2],
    [front.X, front.bottom + 1.2],
  ];
  const ground = points.map(([X, Y]) => unproject(X, Y));
  return ground.slice(1).map(([x2, y2], i) => ({ x1: ground[i][0], y1: ground[i][1], x2, y2, highway: true }));
}

/** Isometric projection: ground (x, y) and height z to a flat (X, Y) before camera and zoom. */
export const ISO_C = Math.cos(Math.PI / 6);
export function project(x: number, y: number, z: number): [number, number] {
  return [(x - y) * ISO_C, (x + y) * 0.5 - z * 0.82];
}

/** The inverse at ground level, for finding which district the pointer is over. */
export function unproject(X: number, Y: number): [number, number] {
  const a = X / ISO_C;
  const b = 2 * Y;
  return [(a + b) / 2, (b - a) / 2];
}

export function districtAt(layout: CityLayout, x: number, y: number, track?: "lld" | "hld"): CityDistrict | undefined {
  return layout.districts.find((d) => (!track || d.track === track) && x >= d.x - 0.3 && x <= d.x + d.w + 0.3 && y >= d.y - 0.3 && y <= d.y + d.d + 0.3);
}

/** The flat bounding box of a set of districts, tall enough to include their buildings. */
export function boundsOf(districts: CityDistrict[], headroom = 2.6): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const d of districts) {
    for (const [x, y] of [
      [d.x, d.y],
      [d.x + d.w, d.y],
      [d.x, d.y + d.d],
      [d.x + d.w, d.y + d.d],
    ]) {
      const [X, Y] = project(x, y, 0);
      const [, top] = project(x, y, headroom);
      minX = Math.min(minX, X);
      maxX = Math.max(maxX, X);
      minY = Math.min(minY, top);
      maxY = Math.max(maxY, Y);
    }
  }
  return { minX, maxX, minY, maxY };
}
