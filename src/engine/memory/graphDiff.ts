/**
 * Compares a graph the learner rebuilt from memory with the reference
 * (PRD: The Studio, "Rebuild from memory"). Shared by Blank Blueprints and Atlas recall.
 */
export interface GraphEdge {
  from: string;
  to: string;
  type: string;
}

export interface Graph {
  nodes: string[];
  edges: GraphEdge[];
}

export interface DiffOptions {
  /** Alternative names for a reference node, e.g. { PricingStrategy: ["IPricingStrategy", "DiscountStrategy"] }. */
  aliases?: Record<string, string[]>;
  /** Nodes or edges that are not in the reference but are still correct. */
  acceptedExtras?: { nodes?: string[]; edges?: GraphEdge[] };
}

export interface GraphDiff {
  nodes: { correct: string[]; missing: string[]; validExtra: string[]; invalidExtra: string[] };
  edges: {
    correct: GraphEdge[];
    /** Right endpoints, wrong relationship type. */
    wrongType: { answer: GraphEdge; expected: GraphEdge }[];
    missing: GraphEdge[];
    validExtra: GraphEdge[];
    invalidExtra: GraphEdge[];
  };
  scores: {
    /** Share of reference concepts recalled. */
    concepts: number;
    /** Share of reference relationships recalled with the right endpoints and direction. */
    relationships: number;
    /** Of those relationships, the share with the right type. */
    types: number;
  };
}

const key = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

export function diffGraphs(reference: Graph, answer: Graph, options: DiffOptions = {}): GraphDiff {
  const canonical = new Map<string, string>();
  for (const node of reference.nodes) {
    canonical.set(key(node), node);
    for (const alias of options.aliases?.[node] ?? []) canonical.set(key(alias), node);
  }
  const extraNodes = new Set((options.acceptedExtras?.nodes ?? []).map(key));
  const normalise = (name: string) => canonical.get(key(name)) ?? name.trim();

  const answerNodes = [...new Set(answer.nodes.map(normalise))];
  const refNodes = new Set(reference.nodes);
  const nodes = {
    correct: answerNodes.filter((n) => refNodes.has(n)),
    missing: reference.nodes.filter((n) => !answerNodes.includes(n)),
    validExtra: answerNodes.filter((n) => !refNodes.has(n) && extraNodes.has(key(n))),
    invalidExtra: answerNodes.filter((n) => !refNodes.has(n) && !extraNodes.has(key(n))),
  };

  const ends = (e: GraphEdge) => `${e.from}→${e.to}`;
  const full = (e: GraphEdge) => `${ends(e)}:${key(e.type)}`;
  const answerEdges = dedupe(answer.edges.map((e) => ({ ...e, from: normalise(e.from), to: normalise(e.to) })), full);
  const refByEnds = new Map(reference.edges.map((e) => [ends(e), e]));
  const extraEdges = new Set((options.acceptedExtras?.edges ?? []).map(full));

  const edges: GraphDiff["edges"] = { correct: [], wrongType: [], missing: [], validExtra: [], invalidExtra: [] };
  const matched = new Set<string>();
  for (const edge of answerEdges) {
    const expected = refByEnds.get(ends(edge));
    if (expected && !matched.has(ends(edge))) {
      matched.add(ends(edge));
      if (key(expected.type) === key(edge.type)) edges.correct.push(edge);
      else edges.wrongType.push({ answer: edge, expected });
    } else if (extraEdges.has(full(edge))) {
      edges.validExtra.push(edge);
    } else {
      edges.invalidExtra.push(edge);
    }
  }
  edges.missing = reference.edges.filter((e) => !matched.has(ends(e)));

  const located = edges.correct.length + edges.wrongType.length;
  return {
    nodes,
    edges,
    scores: {
      concepts: ratio(nodes.correct.length, reference.nodes.length),
      relationships: ratio(located, reference.edges.length),
      types: located === 0 ? 0 : edges.correct.length / located,
    },
  };
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 1 : part / whole;
}

function dedupe<T>(items: T[], by: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = by(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
