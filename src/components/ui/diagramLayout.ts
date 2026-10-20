/**
 * Layered layout for small diagrams (class diagrams and architecture sketches), top to bottom.
 * Parents sit above children (implements/extends point up); everything else flows downward.
 */
export type DiagramKind =
  | "class"
  | "interface"
  | "abstract"
  | "enum"
  | "client"
  | "user"
  | "service"
  | "database"
  | "cache"
  | "queue"
  | "lb"
  | "cdn"
  | "storage"
  | "worker"
  | "gateway"
  | "ghost";

export type DiagramTone = "normal" | "good" | "bad" | "missing" | "extra";

export interface DNode {
  id: string;
  kind?: DiagramKind;
  lines?: string[];
  tone?: DiagramTone;
}

export interface DEdge {
  from: string;
  to: string;
  type: string;
  tone?: DiagramTone;
}

export interface PlacedNode extends DNode {
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
}

export interface PlacedEdge extends DEdge {
  path: string;
  labelX: number;
  labelY: number;
  /** Arrow direction at the end of the path, for drawing the head. */
  end: { x: number; y: number; angle: number };
  start: { x: number; y: number; angle: number };
}

const PARENT_EDGES = new Set(["implements", "extends", "inherits", "is-a", "realizes"]);
const STEREOTYPED = new Set<DiagramKind>(["interface", "abstract", "enum", "database", "cache", "queue", "lb", "cdn", "storage", "worker", "gateway", "service", "user", "client"]);

const LAYER_GAP = 64;
const NODE_GAP = 28;
const CHAR = 7.1;

export function nodeSize(n: DNode) {
  const longest = Math.max(n.id.length * 1.08, ...(n.lines ?? []).map((l) => l.length * 0.95));
  const w = Math.round(Math.min(250, Math.max(112, longest * CHAR + 30)));
  const stereo = n.kind && STEREOTYPED.has(n.kind) ? 14 : 0;
  const h = 34 + stereo + (n.lines?.length ?? 0) * 16 + ((n.lines?.length ?? 0) > 0 ? 6 : 0);
  return { w, h };
}

export function layoutDiagram(nodes: DNode[], edges: DEdge[]) {
  const ids = new Set(nodes.map((n) => n.id));
  const valid = edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);

  // Directed "above → below" pairs.
  const down = valid.map((e) => (PARENT_EDGES.has(e.type) ? { a: e.to, b: e.from } : { a: e.from, b: e.to }));

  // Drop edges that would close a cycle (DFS in input order), so layering always terminates.
  const adjacency = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  const state = new Map<string, 0 | 1 | 2>();
  const kept: { a: string; b: string }[] = [];
  const outgoing = new Map<string, { a: string; b: string }[]>(nodes.map((n) => [n.id, []]));
  for (const d of down) outgoing.get(d.a)!.push(d);
  const visit = (id: string) => {
    state.set(id, 1);
    for (const d of outgoing.get(id)!) {
      const s = state.get(d.b) ?? 0;
      if (s === 1) continue; // back edge
      kept.push(d);
      adjacency.get(d.a)!.push(d.b);
      if (s === 0) visit(d.b);
    }
    state.set(id, 2);
  };
  for (const n of nodes) if (!state.get(n.id)) visit(n.id);

  // Longest-path layering.
  const layer = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false;
    for (const { a, b } of kept) {
      const want = layer.get(a)! + 1;
      if (layer.get(b)! < want) {
        layer.set(b, want);
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Pull sources down next to their first child when that shortens edges (e.g. a client above an interface).
  for (const n of nodes) {
    const children = kept.filter((d) => d.a === n.id).map((d) => layer.get(d.b)!);
    const parents = kept.filter((d) => d.b === n.id);
    if (parents.length === 0 && children.length > 0) layer.set(n.id, Math.min(...children) - 1);
  }
  const minLayer = Math.min(...layer.values());
  for (const [k, v] of layer) layer.set(k, v - minLayer);

  const layerCount = Math.max(...layer.values()) + 1;
  const rows: string[][] = Array.from({ length: layerCount }, () => []);
  for (const n of nodes) rows[layer.get(n.id)!].push(n.id);

  // Barycentre ordering to reduce crossings.
  const neighbours = (id: string) => valid.flatMap((e) => (e.from === id ? [e.to] : e.to === id ? [e.from] : []));
  for (let sweep = 0; sweep < 4; sweep += 1) {
    const order = sweep % 2 === 0 ? rows.keys() : [...rows.keys()].reverse();
    for (const r of order) {
      const position = new Map<string, number>();
      rows.forEach((row) => row.forEach((id, i) => position.set(id, i / Math.max(1, row.length - 1))));
      rows[r] = [...rows[r]].sort((x, y) => bary(x) - bary(y));
      function bary(id: string) {
        const ns = neighbours(id).filter((n) => layer.get(n) !== r);
        if (ns.length === 0) return position.get(id)!;
        return ns.reduce((sum, n) => sum + position.get(n)!, 0) / ns.length;
      }
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sizes = new Map(nodes.map((n) => [n.id, nodeSize(n)]));
  const rowWidth = rows.map((row) => row.reduce((sum, id) => sum + sizes.get(id)!.w, 0) + NODE_GAP * Math.max(0, row.length - 1));
  const width = Math.max(...rowWidth, 200);
  const rowHeight = rows.map((row) => Math.max(0, ...row.map((id) => sizes.get(id)!.h)));

  const placed = new Map<string, PlacedNode>();
  let y = 0;
  rows.forEach((row, r) => {
    let x = (width - rowWidth[r]) / 2;
    for (const id of row) {
      const { w, h } = sizes.get(id)!;
      placed.set(id, { ...byId.get(id)!, x, y: y + (rowHeight[r] - h) / 2, w, h, layer: r });
      x += w + NODE_GAP;
    }
    y += rowHeight[r] + LAYER_GAP;
  });
  const height = y - LAYER_GAP;

  // Edges between the same pair are drawn once; parallel edges between layers fan out a little.
  const placedEdges: PlacedEdge[] = valid.map((e) => {
    const s = placed.get(e.from)!;
    const t = placed.get(e.to)!;
    const sc = { x: s.x + s.w / 2, y: s.y + s.h / 2 };
    const tc = { x: t.x + t.w / 2, y: t.y + t.h / 2 };
    if (s.layer === t.layer) {
      const leftToRight = sc.x < tc.x;
      const p1 = { x: leftToRight ? s.x + s.w : s.x, y: sc.y };
      const p2 = { x: leftToRight ? t.x : t.x + t.w, y: tc.y };
      const mid = (p1.x + p2.x) / 2;
      return {
        ...e,
        path: `M ${p1.x} ${p1.y} C ${mid} ${p1.y - 18}, ${mid} ${p2.y - 18}, ${p2.x} ${p2.y}`,
        labelX: mid,
        labelY: (p1.y + p2.y) / 2 - 16,
        start: { ...p1, angle: leftToRight ? 180 : 0 },
        end: { ...p2, angle: leftToRight ? 0 : 180 },
      };
    }
    const downward = t.layer > s.layer;
    const p1 = { x: sc.x, y: downward ? s.y + s.h : s.y };
    const p2 = { x: tc.x, y: downward ? t.y : t.y + t.h };
    const bend = Math.max(24, Math.abs(p2.y - p1.y) / 2);
    const c1 = { x: p1.x, y: p1.y + (downward ? bend : -bend) };
    const c2 = { x: p2.x, y: p2.y + (downward ? -bend : bend) };
    return {
      ...e,
      path: `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`,
      labelX: (p1.x + p2.x) / 2,
      labelY: (p1.y + p2.y) / 2,
      start: { ...p1, angle: downward ? 270 : 90 },
      end: { ...p2, angle: downward ? 90 : 270 },
    };
  });

  return { nodes: [...placed.values()], edges: placedEdges, width, height };
}
