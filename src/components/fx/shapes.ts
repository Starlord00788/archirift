import { createRandom } from "@/engine/random";

/**
 * Point clouds for the hero's morphing city. Every shape has exactly `n` points, so point i of one
 * shape flies to point i of the next. Coordinates fit roughly inside a unit sphere; `hue` (0–1)
 * picks a colour along the brand gradient for each point.
 */
export interface Cloud {
  xyz: Float32Array; // n * 3
  hue: Float32Array; // n
}

export const SHAPES = [
  { id: "planet", label: "The city", caption: "One rift in a living city" },
  { id: "skyline", label: "Classes", caption: "Objects built floor by floor" },
  { id: "system", label: "Systems", caption: "Traffic through a load balancer" },
  { id: "lattice", label: "Patterns", caption: "Interfaces holding it together" },
] as const;

export type ShapeId = (typeof SHAPES)[number]["id"];

type Emit = (x: number, y: number, z: number, hue: number) => void;

function build(n: number, seed: number, draw: (emit: Emit, random: () => number, budget: number) => void): Cloud {
  const xyz = new Float32Array(n * 3);
  const hue = new Float32Array(n);
  let i = 0;
  const random = createRandom(seed);
  const emit: Emit = (x, y, z, h) => {
    if (i >= n) return;
    xyz[i * 3] = x;
    xyz[i * 3 + 1] = y;
    xyz[i * 3 + 2] = z;
    hue[i] = h;
    i += 1;
  };
  draw(emit, random, n);
  // Any leftover budget becomes faint dust around the shape, so counts always match.
  while (i < n) {
    const r = 1.15 + random() * 0.5;
    const t = random() * Math.PI * 2;
    const p = Math.acos(2 * random() - 1);
    emit(r * Math.sin(p) * Math.cos(t), r * Math.cos(p) * 0.6, r * Math.sin(p) * Math.sin(t), random());
  }
  return { xyz, hue };
}

/** A glowing planet with a tilted ring of data: the city seen from orbit. */
function planet(n: number): Cloud {
  return build(n, 11, (emit, random, budget) => {
    const shell = Math.floor(budget * 0.72);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < shell; i += 1) {
      const y = 1 - (i / (shell - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = golden * i;
      emit(Math.cos(t) * r * 0.82, y * 0.82, Math.sin(t) * r * 0.82, (y + 1) / 2);
    }
    const ring = Math.floor(budget * 0.22);
    const tilt = 0.42;
    for (let i = 0; i < ring; i += 1) {
      const t = random() * Math.PI * 2;
      const r = 1.05 + random() * 0.32;
      const x = Math.cos(t) * r;
      const z = Math.sin(t) * r;
      const jitter = (random() - 0.5) * 0.03;
      emit(x, z * Math.sin(tilt) + jitter, z * Math.cos(tilt), 0.85 + random() * 0.15);
    }
  });
}

/** A skyline of towers: each building is a class, each glowing floor a responsibility. */
function skyline(n: number): Cloud {
  return build(n, 23, (emit, random, budget) => {
    const towers: { x: number; z: number; w: number; h: number }[] = [];
    const spots: [number, number][] = [
      [0, 0], [-0.42, 0.1], [0.42, -0.1], [-0.2, -0.42], [0.22, 0.42], [-0.78, -0.25], [0.8, 0.22],
      [-0.6, 0.48], [0.6, -0.5], [0.05, 0.8], [-0.1, -0.85], [-0.95, 0.3], [0.98, -0.3], [0.45, 0.85],
    ];
    spots.forEach(([x, z], i) => {
      const centre = 1 - Math.hypot(x, z) / 1.4;
      towers.push({ x, z, w: 0.09 + random() * 0.05, h: 0.35 + centre * 1.2 + (i === 0 ? 0.35 : random() * 0.25) });
    });
    const base = -0.75;
    // A faint ground grid.
    const ground = Math.floor(budget * 0.1);
    for (let i = 0; i < ground; i += 1) {
      const line = random() < 0.5;
      const a = Math.round((random() * 2 - 1) * 5) / 5;
      const b = random() * 2.2 - 1.1;
      emit(line ? a : b, base, line ? b : a, 0.05);
    }
    const perTower = Math.floor((budget * 0.88) / towers.length);
    for (const t of towers) {
      const floors = Math.max(3, Math.round(t.h / 0.11));
      for (let k = 0; k < perTower; k += 1) {
        const sx = random() < 0.5 ? -1 : 1;
        const sz = random() < 0.5 ? -1 : 1;
        if (random() < 0.5) {
          // The four vertical edges.
          const y = base + random() * t.h;
          emit(t.x + sx * t.w, y, t.z + sz * t.w, 0.15 + ((y - base) / 1.9) * 0.85);
        } else {
          // Floor outlines: rings of light at each storey, brightest at the top.
          const f = Math.floor(random() * (floors + 1));
          const y = base + (f / floors) * t.h;
          const along = (random() * 2 - 1) * t.w;
          const onX = random() < 0.5;
          emit(t.x + (onX ? along : sx * t.w), y, t.z + (onX ? sz * t.w : along), f === floors ? 1 : 0.2 + (f / floors) * 0.7);
        }
      }
    }
  });
}

/** Clients → load balancer → servers → database, joined by streams of requests. */
function system(n: number): Cloud {
  return build(n, 37, (emit, random, budget) => {
    const sphere = (cx: number, cy: number, cz: number, r: number, count: number, hue: number) => {
      for (let i = 0; i < count; i += 1) {
        const t = random() * Math.PI * 2;
        const p = Math.acos(2 * random() - 1);
        emit(cx + r * Math.sin(p) * Math.cos(t), cy + r * Math.cos(p), cz + r * Math.sin(p) * Math.sin(t), hue);
      }
    };
    const box = (cx: number, cy: number, cz: number, w: number, h: number, d: number, count: number, hue: number) => {
      for (let i = 0; i < count; i += 1) {
        const face = Math.floor(random() * 3);
        const s = random() < 0.5 ? -1 : 1;
        const u = random() * 2 - 1;
        const v = random() * 2 - 1;
        if (face === 0) emit(cx + s * w, cy + u * h, cz + v * d, hue);
        else if (face === 1) emit(cx + u * w, cy + s * h, cz + v * d, hue);
        else emit(cx + u * w, cy + v * h, cz + s * d, hue);
      }
    };
    const unit = Math.floor(budget / 40);
    for (const y of [-0.55, 0, 0.55]) sphere(-1.15, y, 0, 0.11, unit, 0.05);
    sphere(-0.4, 0, 0, 0.17, unit * 2, 0.45);
    for (const y of [-0.55, 0, 0.55]) box(0.35, y, 0, 0.16, 0.12, 0.16, unit * 2, 0.7);
    // Database: a stacked cylinder.
    for (let i = 0; i < unit * 4; i += 1) {
      const t = random() * Math.PI * 2;
      const y = (random() * 2 - 1) * 0.3;
      const ring = random() < 0.35 ? Math.round(y / 0.15) * 0.15 : y;
      emit(1.1 + Math.cos(t) * 0.2, ring, Math.sin(t) * 0.2, 0.95);
    }
    // Request streams along curves between the parts.
    const links: [number, number, number, number][] = [
      [-1.15, -0.55, -0.4, 0],
      [-1.15, 0, -0.4, 0],
      [-1.15, 0.55, -0.4, 0],
      [-0.4, 0, 0.35, -0.55],
      [-0.4, 0, 0.35, 0],
      [-0.4, 0, 0.35, 0.55],
      [0.35, -0.55, 1.1, 0],
      [0.35, 0, 1.1, 0],
      [0.35, 0.55, 1.1, 0],
    ];
    const used = unit * 3 + unit * 2 + unit * 6 + unit * 4;
    const perLink = Math.floor((budget - used) * 0.85 / links.length);
    links.forEach(([x1, y1, x2, y2], li) => {
      for (let i = 0; i < perLink; i += 1) {
        const t = random();
        const e = t * t * (3 - 2 * t);
        emit(x1 + (x2 - x1) * t, y1 + (y2 - y1) * e, (random() - 0.5) * 0.04, 0.3 + (li / links.length) * 0.6);
      }
    });
  });
}

/** A lattice of classes (cubes) wired to interfaces: the shape of a good design. */
function lattice(n: number): Cloud {
  return build(n, 53, (emit, random, budget) => {
    const nodes: [number, number, number][] = [
      [0, 0.7, 0],
      [-0.75, 0, 0.35],
      [0, 0, -0.45],
      [0.75, 0, 0.35],
      [-1.05, -0.7, 0],
      [-0.35, -0.7, 0.6],
      [0.35, -0.7, -0.55],
      [1.05, -0.7, 0],
    ];
    const edges: [number, number][] = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 4],
      [1, 5],
      [2, 6],
      [3, 6],
      [3, 7],
    ];
    const cube = Math.floor((budget * 0.62) / nodes.length);
    nodes.forEach(([cx, cy, cz], ni) => {
      const s = ni === 0 ? 0.2 : 0.14;
      for (let i = 0; i < cube; i += 1) {
        // Wireframe: points along the 12 edges of each cube.
        const axis = Math.floor(random() * 3);
        const a = random() < 0.5 ? -1 : 1;
        const b = random() < 0.5 ? -1 : 1;
        const t = random() * 2 - 1;
        const p = axis === 0 ? [t, a, b] : axis === 1 ? [a, t, b] : [a, b, t];
        emit((cx + p[0] * s) * 0.82, (cy + p[1] * s) * 0.82 + 0.06, (cz + p[2] * s) * 0.82, ni === 0 ? 0.95 : 0.35 + cy * 0.3);
      }
    });
    const perEdge = Math.floor((budget * 0.33) / edges.length);
    edges.forEach(([from, to]) => {
      const [x1, y1, z1] = nodes[from];
      const [x2, y2, z2] = nodes[to];
      for (let i = 0; i < perEdge; i += 1) {
        const t = random();
        emit((x1 + (x2 - x1) * t) * 0.82, (y1 + (y2 - y1) * t) * 0.82 + 0.06, (z1 + (z2 - z1) * t) * 0.82, 0.6 + t * 0.3);
      }
    });
  });
}

const BUILDERS: Record<ShapeId, (n: number) => Cloud> = { planet, skyline, system, lattice };

export function buildClouds(n: number): Cloud[] {
  return SHAPES.map((s) => BUILDERS[s.id](n));
}
