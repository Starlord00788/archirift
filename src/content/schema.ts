import { z } from "zod";
import { RiftSchema, findRiftProblems } from "./rift";

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

export const TRACKS = ["lld", "hld"] as const;

export const WorldSchema = z.object({
  id,
  name: z.string().min(1),
  track: z.enum(TRACKS),
  order: z.number().int().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  /** One of the design tokens, used for the world's accent colour. */
  accent: z.enum(["flow", "player", "warn", "good", "pink", "lime"]),
});

export const LevelSchema = z.object({
  id,
  title: z.string().min(1),
  summary: z.string().min(1),
  world: z.string().min(1),
  /** Position on the world's path. */
  order: z.number().int().min(1).default(1),
  difficulty: z.number().int().min(1).max(3).default(1),
  /** Levels with hand-built code (like the Hydra) instead of a generic rift. */
  bespoke: z.boolean().default(false),
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
  ]).default("story-scene"),
  concepts: z.array(id).min(1),
  prerequisites: z.array(id).default([]),
  minutes: z.number().int().min(1).max(90),
  primaryVisual: z.string().min(1).default("class-diagram"),
  beats: z.array(z.enum(BEATS)).default([...BEATS]),
  blankBlueprint: z.boolean().default(true),
  whenNotToUse: z.string().min(1),
  rift: RiftSchema.optional(),
});

export type Concept = z.infer<typeof ConceptSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type Level = z.infer<typeof LevelSchema>;
export type World = z.infer<typeof WorldSchema>;

export interface ContentBundle {
  worlds?: World[];
  concepts: Concept[];
  edges: Edge[];
  levels: Level[];
}

/**
 * Cross-file rules that a schema alone cannot express (PRD: contributor workflow, CI checks).
 * Returns a list of human-readable problems; an empty list means the content is valid.
 */
export function findContentProblems({ worlds, concepts, edges, levels }: ContentBundle): string[] {
  const problems: string[] = [];
  const worldIds = new Set(worlds?.map((w) => w.id));
  if (worlds && worldIds.size !== worlds.length) problems.push("a world is defined twice");
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
    if (worlds && !worldIds.has(level.world)) problems.push(`level "${level.id}" is in unknown world "${level.world}"`);
    if (!level.bespoke && !level.rift) problems.push(`level "${level.id}" has neither a rift nor bespoke code`);
    if (level.rift) problems.push(...findRiftProblems(level.id, level.rift));
  }

  if (worlds) {
    for (const world of worlds) {
      const orders = levels.filter((l) => l.world === world.id).map((l) => l.order);
      if (new Set(orders).size !== orders.length) problems.push(`world "${world.id}" has two levels with the same order`);
    }
  }

  return problems;
}
