import { z } from "zod";

/** The fixed relationship vocabulary used by the Atlas (PRD: "Edges carry meaning"). */
export const EDGE_TYPES = [
  "requires",
  "enables",
  "realised-by",
  "used-in",
  "causes",
  "mitigated-by",
  "trades-off-against",
  "is-a-kind-of",
  "contrasts-with",
  "part-of",
] as const;

export const BEATS = ["pain", "play", "proof", "recall"] as const;

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ids are lowercase kebab-case");

export const ConceptSchema = z.object({
  id,
  name: z.string().min(1),
  tier: z.enum(["core", "important", "codex", "link-out"]),
  world: z.string().min(1),
  rule: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  analogy: z
    .object({ scene: z.string().min(1), breaksWhen: z.string().min(1) })
    .optional(),
  misconceptions: z
    .array(z.object({ claim: z.string().min(1), correction: z.string().min(1) }))
    .default([]),
});

export const EdgeSchema = z.object({
  from: id,
  to: id,
  type: z.enum(EDGE_TYPES),
  explanation: z.string().min(1),
  chain: z.string().optional(),
});

export const LevelSchema = z.object({
  id,
  title: z.string().min(1),
  summary: z.string().min(1),
  world: z.string().min(1),
  type: z.enum([
    "story-scene",
    "blueprint-puzzle",
    "refactor-rush",
    "code-forge",
    "pattern-match",
    "sequence-builder",
    "race-lab",
    "contract",
    "sandbox-sim",
  ]),
  concepts: z.array(id).min(1),
  prerequisites: z.array(id).default([]),
  minutes: z.number().int().min(1).max(90),
  primaryVisual: z.string().min(1),
  beats: z.array(z.enum(BEATS)),
  blankBlueprint: z.boolean(),
  whenNotToUse: z.string().min(1),
});

export type Concept = z.infer<typeof ConceptSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type Level = z.infer<typeof LevelSchema>;

export interface ContentBundle {
  concepts: Concept[];
  edges: Edge[];
  levels: Level[];
}

/**
 * Cross-file rules that a schema alone cannot express (PRD: contributor workflow, CI checks).
 * Returns a list of human-readable problems; an empty list means the content is valid.
 */
export function findContentProblems({ concepts, edges, levels }: ContentBundle): string[] {
  const problems: string[] = [];
  const conceptIds = new Set<string>();

  for (const concept of concepts) {
    if (conceptIds.has(concept.id)) problems.push(`concept "${concept.id}" is defined twice`);
    conceptIds.add(concept.id);
  }

  for (const edge of edges) {
    for (const end of [edge.from, edge.to]) {
      if (!conceptIds.has(end)) problems.push(`edge ${edge.from} -> ${edge.to} uses unknown concept "${end}"`);
    }
    if (edge.from === edge.to) problems.push(`edge on "${edge.from}" points to itself`);
  }

  const levelIds = new Set<string>();
  for (const level of levels) {
    if (levelIds.has(level.id)) problems.push(`level "${level.id}" is defined twice`);
    levelIds.add(level.id);

    for (const ref of [...level.concepts, ...level.prerequisites]) {
      if (!conceptIds.has(ref)) problems.push(`level "${level.id}" uses unknown concept "${ref}"`);
    }
    for (const beat of BEATS) {
      if (!level.beats.includes(beat)) problems.push(`level "${level.id}" is missing the "${beat}" beat`);
    }
    if (!level.blankBlueprint) problems.push(`level "${level.id}" has no Blank Blueprint`);
  }

  return problems;
}
