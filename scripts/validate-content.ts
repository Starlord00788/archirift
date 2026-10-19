import { loadValidContent } from "../src/content/load";

try {
  const { concepts, edges, levels } = loadValidContent();
  console.log(`Content OK: ${concepts.length} concepts, ${edges.length} edges, ${levels.length} levels.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
