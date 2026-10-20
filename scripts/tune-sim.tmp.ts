import { SimConfigSchema, WaveSchema } from "../src/content/rift";
import { simulate } from "../src/rift/sim";
const [goalsJson, wavesJson, ...configs] = process.argv.slice(2);
const goals = { backlogPerSec: 0, ...JSON.parse(goalsJson) };
const waves = JSON.parse(wavesJson).map((w: unknown) => WaveSchema.parse(w));
for (const c of configs) {
  const config = SimConfigSchema.parse(JSON.parse(c));
  console.log(c);
  for (const w of waves) {
    const r = simulate(config, w, goals);
    console.log(`  ${w.name.padEnd(14)} ${r.passed ? "PASS" : "fail"} ${r.avgMs}ms err ${r.errorPct}% cost ${r.cost} backlog ${r.backlogPerSec} | ${r.tiers.map((t) => `${t.id}:${Math.round(t.utilisation * 100)}`).join(" ")} | ${r.findings[0] ?? ""}`);
  }
}
