import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import {
  ConceptSchema,
  EdgeSchema,
  LevelSchema,
  WorldSchema,
  findContentProblems,
  type ContentBundle,
} from "./schema";

const CONTENT_DIR = path.join(process.cwd(), "content");

function readYaml<T>(file: string, schema: z.ZodType<T>): T {
  const raw = parse(readFileSync(file, "utf8"));
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`${path.relative(process.cwd(), file)}: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Reads every content file. Runs at build time only (server components and scripts). */
export function loadContent(contentDir = CONTENT_DIR): ContentBundle & { worlds: NonNullable<ContentBundle["worlds"]> } {
  const worlds = readYaml(path.join(contentDir, "graph", "worlds.yaml"), z.array(WorldSchema)).sort((a, b) => a.order - b.order);
  const concepts = readYaml(path.join(contentDir, "graph", "concepts.yaml"), z.array(ConceptSchema));
  const edges = readYaml(path.join(contentDir, "graph", "edges.yaml"), z.array(EdgeSchema));

  const worldOrder = (id: string) => worlds.find((w) => w.id === id)?.order ?? Number.MAX_SAFE_INTEGER;
  const levelsDir = path.join(contentDir, "levels");
  const levels = readdirSync(levelsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(levelsDir, entry.name, "level.yaml"))
    .filter((file) => existsSync(file))
    .map((file) => readYaml(file, LevelSchema))
    .sort((a, b) => worldOrder(a.world) - worldOrder(b.world) || a.order - b.order);

  return { worlds, concepts, edges, levels };
}

/** Loads content and throws if any cross-file rule is broken, so a bad level fails the build. */
let cached: ReturnType<typeof loadContent> | undefined;

export function loadValidContent(contentDir = CONTENT_DIR) {
  if (cached && contentDir === CONTENT_DIR) return cached;
  const bundle = loadContent(contentDir);
  const problems = findContentProblems(bundle);
  if (problems.length > 0) {
    throw new Error(`Content problems:\n- ${problems.join("\n- ")}`);
  }
  // Every page calls this several times while the site is built; parse the YAML once per process.
  if (contentDir === CONTENT_DIR) cached = bundle;
  return bundle;
}
