import { z } from "zod";

/**
 * Content for a generic, data-driven level ("a rift"). Each level is a YAML file; the engine in
 * src/rift turns it into Pain → Play → Proof → Recall without level-specific code.
 */

const text = z.string().min(1);
/** Ids of sortable, orderable and estimate items: kebab-case, so they can never collide with object internals. */
const itemId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "item ids are lowercase kebab-case");

export const LANGUAGES = ["java", "ts", "js", "python", "sql", "text", "http", "yaml"] as const;

export const CodeSchema = z.object({
  language: z.enum(LANGUAGES).default("java"),
  source: text,
  /** 1-based line numbers to highlight, e.g. the smell or the change. */
  highlight: z.array(z.number().int().min(1)).default([]),
});

export const NODE_KINDS = [
  "class",
  "interface",
  "abstract",
  "enum",
  "client",
  "user",
  "service",
  "database",
  "cache",
  "queue",
  "lb",
  "cdn",
  "storage",
  "worker",
  "gateway",
] as const;

export const DiagramNodeSchema = z.object({
  id: text,
  kind: z.enum(NODE_KINDS).default("class"),
  lines: z.array(z.string()).default([]),
});

export const DiagramEdgeSchema = z.object({ from: text, to: text, type: text });

export const DiagramSchema = z.object({
  nodes: z.array(DiagramNodeSchema).min(1),
  edges: z.array(DiagramEdgeSchema).default([]),
});

export const ShowSchema = z.object({
  code: CodeSchema.optional(),
  diagram: DiagramSchema.optional(),
  note: z.string().optional(),
});

const OptionSchema = z.object({ text, correct: z.boolean().default(false), feedback: text });
const ChoiceSchema = z.object({ text, correct: z.boolean().default(false), why: text });

export const QuestionSchema = z.object({ prompt: text, choices: z.array(ChoiceSchema).min(2).max(5) });

// ---------------- Play stages ----------------

const StageBase = { title: text, intro: text };

export const StepsStageSchema = z.object({
  kind: z.literal("steps"),
  ...StageBase,
  start: ShowSchema.default({}),
  steps: z
    .array(z.object({ prompt: text, options: z.array(OptionSchema).min(2).max(5), after: ShowSchema.default({}) }))
    .min(1),
});

export const SortStageSchema = z.object({
  kind: z.literal("sort"),
  ...StageBase,
  buckets: z.array(z.object({ id: itemId, label: text, hint: z.string().optional() })).min(2).max(4),
  items: z.array(z.object({ id: itemId, text, bucket: itemId, why: text })).min(3),
});

export const OrderStageSchema = z.object({
  kind: z.literal("order"),
  ...StageBase,
  /** Listed in the correct order; the game shuffles them deterministically. */
  items: z.array(z.object({ id: itemId, text, why: z.string().optional() })).min(3).max(9),
});

export const EstimateStageSchema = z.object({
  kind: z.literal("estimate"),
  ...StageBase,
  questions: z
    .array(
      z.object({
        id: itemId,
        prompt: text,
        givens: z.array(text).default([]),
        answer: z.number().positive(),
        unit: text,
        /** Accepted if within this factor of the answer (back-of-the-envelope, not exact). */
        tolerance: z.number().min(1.1).max(10).default(2),
        working: text,
      }),
    )
    .min(1),
});

export const SIM_KNOBS = [
  "servers",
  "serverSize",
  "cache",
  "cdn",
  "replicas",
  "shards",
  "queue",
  "workers",
  "rateLimit",
  "breaker",
] as const;
export type SimKnob = (typeof SIM_KNOBS)[number];

export const SimConfigSchema = z.object({
  servers: z.number().int().min(1).max(40).default(1),
  serverSize: z.number().int().min(1).max(4).default(1),
  cache: z.boolean().default(false),
  cdn: z.boolean().default(false),
  replicas: z.number().int().min(0).max(10).default(0),
  shards: z.number().int().min(1).max(16).default(1),
  queue: z.boolean().default(false),
  workers: z.number().int().min(0).max(40).default(0),
  rateLimit: z.boolean().default(false),
  breaker: z.boolean().default(false),
});
export type SimConfig = z.infer<typeof SimConfigSchema>;

export const WaveSchema = z.object({
  name: text,
  story: text,
  /** Legitimate requests per second. */
  rps: z.number().positive(),
  /** Share of dynamic requests that are reads. */
  readRatio: z.number().min(0).max(1).default(0.8),
  /** Share of requests for static files (images, scripts). */
  staticRatio: z.number().min(0).max(1).default(0),
  /** Extra abusive requests per second from bots or a misbehaving client. */
  botRps: z.number().min(0).default(0),
  /** Share of reads the cache can answer when enabled. */
  cacheHitRate: z.number().min(0).max(0.99).default(0.85),
  /** One app server crashes during the wave. */
  serverCrash: z.boolean().default(false),
  /** A downstream dependency (e.g. payments) hangs; this share of requests calls it. */
  dependencyDown: z.number().min(0).max(1).default(0),
  /** Share of writes that hit one hot partition key (sharding can't spread these). */
  hotKeyShare: z.number().min(0).max(1).default(0),
});
export type Wave = z.infer<typeof WaveSchema>;

export const SimSpecSchema = z.object({
  knobs: z.array(z.enum(SIM_KNOBS)).min(1),
  start: SimConfigSchema.default(SimConfigSchema.parse({})),
  goals: z.object({
    avgMs: z.number().positive(),
    errorPct: z.number().min(0).max(100),
    budget: z.number().positive(),
    /** Queue backlog growth allowed, in messages per second. */
    backlogPerSec: z.number().min(0).default(0),
  }),
  waves: z.array(WaveSchema).min(1).max(5),
  /** A configuration that passes every wave; checked by tests so every level is winnable. */
  solution: SimConfigSchema,
});
export type SimSpec = z.infer<typeof SimSpecSchema>;

export const WIDGETS = ["hashring", "bloom", "token-bucket", "lru", "race"] as const;

export const LabStageSchema = z.object({
  kind: z.literal("lab"),
  ...StageBase,
  widget: z.enum(WIDGETS),
});

export const SimStageSchema = z.object({ kind: z.literal("sim"), ...StageBase, sim: SimSpecSchema });

/** Write real code: JavaScript run against hidden tests in the browser. */
export const CodeStageSchema = z.object({
  kind: z.literal("code"),
  ...StageBase,
  /** Read-only code the learner builds on, shown above the editor and run before their code. */
  given: z.string().default(""),
  /** What the editor starts with. */
  starter: text,
  /** A reference solution; content tests check it passes every test, so each level is winnable. */
  solution: text,
  tests: z.array(z.object({ name: text, code: text })).min(1).max(12),
  hint: z.string().optional(),
});

export const StageSchema = z.discriminatedUnion("kind", [
  StepsStageSchema,
  SortStageSchema,
  OrderStageSchema,
  EstimateStageSchema,
  SimStageSchema,
  LabStageSchema,
  CodeStageSchema,
]);
export type Stage = z.infer<typeof StageSchema>;

// ---------------- Recall ----------------

export const BlueprintRecallSchema = z.object({
  kind: z.literal("blueprint"),
  prompt: text,
  palette: z.array(text).min(3),
  relations: z.array(text).min(1),
  reference: z.object({ nodes: z.array(text).min(2), edges: z.array(DiagramEdgeSchema).min(1) }),
  /** Node kinds for drawing; anything not listed is a class. */
  kinds: z.record(z.string(), z.enum(NODE_KINDS)).default({}),
  aliases: z.record(z.string(), z.array(z.string())).default({}),
  acceptedExtras: z
    .object({ nodes: z.array(z.string()).default([]), edges: z.array(DiagramEdgeSchema).default([]) })
    .default({ nodes: [], edges: [] }),
});

export const ClozeRecallSchema = z.object({
  kind: z.literal("cloze"),
  prompt: text,
  /** Blanks are written [[answer]] or [[answer|accepted alternative]]. */
  text,
  /** Words to choose from: every answer plus distractors. */
  bank: z.array(text).min(3),
});

export const RecallSchema = z.discriminatedUnion("kind", [BlueprintRecallSchema, ClozeRecallSchema]);
export type Recall = z.infer<typeof RecallSchema>;

// ---------------- The whole rift ----------------

export const CodexSchema = z.object({
  oneLiner: text,
  analogy: text,
  keyPoints: z.array(text).min(2),
  whenToUse: z.array(text).min(1),
  whenNotToUse: z.array(text).min(1),
  interviewTells: z.array(text).min(1),
  pitfalls: z.array(text).default([]),
  code: CodeSchema.optional(),
});
export type Codex = z.infer<typeof CodexSchema>;

export const RiftSchema = z.object({
  pain: z.object({
    scene: text,
    code: CodeSchema.optional(),
    diagram: DiagramSchema.optional(),
    prompt: text,
    options: z.array(z.object({ text, outcome: text })).min(2).max(4),
    lesson: text,
  }),
  play: z.array(StageSchema).min(1).max(5),
  boss: z.object({ name: text, taunt: text, questions: z.array(QuestionSchema).min(2).max(5) }),
  recall: RecallSchema,
  codex: CodexSchema,
  /** Extra review cards for the spaced-repetition queue, on top of the boss questions. */
  cards: z.array(QuestionSchema).default([]),
});
export type Rift = z.infer<typeof RiftSchema>;

/** Parses `[[answer|alt]]` blanks out of cloze text. */
export function clozeParts(source: string): ({ kind: "text"; value: string } | { kind: "blank"; answers: string[] })[] {
  const parts: ({ kind: "text"; value: string } | { kind: "blank"; answers: string[] })[] = [];
  const pattern = /\[\[([^\]]+)\]\]/g;
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > last) parts.push({ kind: "text", value: source.slice(last, match.index) });
    parts.push({ kind: "blank", answers: match[1].split("|").map((s) => s.trim()) });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ kind: "text", value: source.slice(last) });
  return parts;
}

/** Problems inside one rift that a schema cannot express. */
export function findRiftProblems(levelId: string, rift: Rift): string[] {
  const problems: string[] = [];
  const at = (where: string) => `level "${levelId}" ${where}`;

  rift.play.forEach((stage, s) => {
    const where = `stage ${s + 1} (${stage.kind})`;
    if (stage.kind === "steps") {
      stage.steps.forEach((step, i) => {
        if (!step.options.some((o) => o.correct)) problems.push(at(`${where} step ${i + 1} has no correct option`));
      });
    }
    if (stage.kind === "sort") {
      const ids = new Set(stage.buckets.map((b) => b.id));
      for (const item of stage.items) {
        if (!ids.has(item.bucket)) problems.push(at(`${where} item "${item.id}" uses unknown bucket "${item.bucket}"`));
      }
      for (const bucket of stage.buckets) {
        if (!stage.items.some((i) => i.bucket === bucket.id)) problems.push(at(`${where} bucket "${bucket.id}" has no items`));
      }
      if (new Set(stage.items.map((i) => i.id)).size !== stage.items.length) problems.push(at(`${where} has duplicate item ids`));
    }
    if (stage.kind === "order" && new Set(stage.items.map((i) => i.id)).size !== stage.items.length) {
      problems.push(at(`${where} has duplicate item ids`));
    }
    if (stage.kind === "sim") {
      for (const knob of Object.keys(stage.sim.solution) as (keyof typeof stage.sim.solution)[]) {
        const changed = stage.sim.solution[knob] !== stage.sim.start[knob];
        if (changed && !stage.sim.knobs.includes(knob as never)) problems.push(at(`${where} solution changes "${knob}", which the player can't change`));
      }
    }
  });

  rift.boss.questions.forEach((q, i) => {
    if (q.choices.filter((c) => c.correct).length !== 1) problems.push(at(`boss question ${i + 1} must have exactly one correct choice`));
  });
  rift.cards.forEach((q, i) => {
    if (q.choices.filter((c) => c.correct).length !== 1) problems.push(at(`card ${i + 1} must have exactly one correct choice`));
  });

  const recall = rift.recall;
  if (recall.kind === "blueprint") {
    const palette = new Set(recall.palette);
    const nodes = new Set(recall.reference.nodes);
    for (const node of recall.reference.nodes) {
      if (!palette.has(node)) problems.push(at(`recall node "${node}" is not in the palette`));
    }
    for (const edge of recall.reference.edges) {
      for (const end of [edge.from, edge.to]) {
        if (!nodes.has(end)) problems.push(at(`recall arrow ${edge.from} -> ${edge.to} uses "${end}", which is not a reference node`));
      }
      if (!recall.relations.includes(edge.type)) problems.push(at(`recall arrow type "${edge.type}" is not in relations`));
    }
    const pairs = recall.reference.edges.map((e) => `${e.from}->${e.to}`);
    if (new Set(pairs).size !== pairs.length) problems.push(at("recall has two arrows between the same pair of nodes (the player can draw only one)"));
    const distractors = recall.palette.filter((p) => !nodes.has(p) && !recall.acceptedExtras.nodes.includes(p));
    if (distractors.length < 2) problems.push(at("recall palette needs at least two distractors"));
  } else {
    const blanks = clozeParts(recall.text).filter((p) => p.kind === "blank");
    if (blanks.length < 2) problems.push(at("cloze recall needs at least two blanks"));
    for (const blank of blanks) {
      if (blank.kind === "blank" && !recall.bank.includes(blank.answers[0])) {
        problems.push(at(`cloze answer "${blank.answers[0]}" is not in the word bank`));
      }
    }
  }
  return problems;
}
