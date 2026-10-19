import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import {
  ConceptSchema,
  EdgeSchema,
  LevelSchema,
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
export function loadContent(contentDir = CONTENT_DIR): ContentBundle {
  const concepts = readYaml(path.join(contentDir, "graph", "concepts.yaml"), z.array(ConceptSchema));
  const edges = readYaml(path.join(contentDir, "graph", "edges.yaml"), z.array(EdgeSchema));

  const levelsDir = path.join(contentDir, "levels");
  const levels = readdirSync(levelsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(levelsDir, entry.name, "level.yaml"))
    .filter((file) => existsSync(file))
    .map((file) => readYaml(file, LevelSchema));

  return { concepts, edges, levels };
}

/** Loads content and throws if any cross-file rule is broken, so a bad level fails the build. */
export function loadValidContent(contentDir = CONTENT_DIR): ContentBundle {
  const bundle = loadContent(contentDir);
  const problems = findContentProblems(bundle);
  if (problems.length > 0) {
    throw new Error(`Content problems:\n- ${problems.join("\n- ")}`);
  }
  return bundle;
}
