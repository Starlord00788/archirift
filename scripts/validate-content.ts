import { loadValidContent } from "../src/content/load";
import { choiceQuestions, findQualityIssues, longestShare, MAX_LONGEST_SHARE } from "../src/content/quality";

try {
  const { concepts, edges, levels } = loadValidContent();
  const rifts = levels.filter((l) => l.rift);
  // Fairness: no question should be answerable by picking the longest option.
  const issues = rifts.flatMap((l) => findQualityIssues(l.id, l.rift!));
  const share = longestShare(rifts.flatMap((l) => choiceQuestions(l.rift!)));
  for (const issue of issues) console.error(`level "${issue.levelId}" ${issue.where}: ${issue.message}`);
  if (share > MAX_LONGEST_SHARE) console.error(`The right answer is the longest option in ${Math.round(share * 100)}% of questions (at most ${MAX_LONGEST_SHARE * 100}%).`);
  if (issues.length > 0 || share > MAX_LONGEST_SHARE) process.exit(1);
  console.log(`Content OK: ${concepts.length} concepts, ${edges.length} edges, ${levels.length} levels. Longest option is right in ${Math.round(share * 100)}% of questions.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
