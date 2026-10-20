import { z } from "zod";
import { clozeParts, SimConfigSchema, type Rift, type SimConfig, type Stage } from "@/content/rift";
import { createRandom } from "@/engine/random";
import { diffGraphs, type Graph, type GraphDiff } from "@/engine/memory/graphDiff";
import type { SnapshotCodec } from "@/persistence/repository";
import type { CodeTestResult } from "./code";
import { simulate } from "./sim";

export type RiftBeat = "pain" | "play" | "proof" | "recall" | "reward";
export type Confidence = "sure" | "unsure" | "guessing";
export type Tone = "good" | "bad" | "info";

export type StageState =
  | { kind: "steps"; step: number; wrong: number[]; done: boolean }
  | { kind: "sort"; placed: Record<string, string>; checked: boolean; done: boolean }
  | { kind: "order"; order: string[]; checked: boolean; done: boolean }
  | { kind: "estimate"; answers: Record<string, number | null>; solved: string[]; done: boolean }
  | { kind: "sim"; config: SimConfig; wave: number; runs: number; lastPassed: boolean | null; done: boolean }
  | { kind: "lab"; data: unknown; done: boolean }
  | { kind: "code"; source: string; results: CodeTestResult[] | null; runs: number; done: boolean };

/** Everything needed to resume a rift exactly where the learner left it. */
export interface RiftState {
  /** Fingerprint of the content's structure; a mismatch means the level changed since this save. */
  shape: string;
  beat: RiftBeat;
  painTried: number[];
  stage: number;
  stages: StageState[];
  boss: { answers: (number | null)[] };
  recall: { graph: Graph; cloze: (string | null)[]; confidence: Confidence | null; submitted: boolean };
  hintsUsed: number;
  missteps: number;
  feedback: { tone: Tone; text: string } | null;
  startedAt: string;
  finishedAt: string | null;
}

export type RiftAction =
  | { type: "painTry"; option: number }
  | { type: "toPlay" }
  | { type: "stepChoose"; option: number }
  | { type: "sortPlace"; item: string; bucket: string | null }
  | { type: "sortCheck" }
  | { type: "orderMove"; item: string; to: number }
  | { type: "orderSet"; order: string[] }
  | { type: "orderCheck" }
  | { type: "estimateAnswer"; question: string; value: number | null }
  | { type: "estimateCheck"; question: string }
  | { type: "simSet"; config: SimConfig }
  | { type: "simRun" }
  | { type: "labUpdate"; data: unknown }
  | { type: "labDone" }
  | { type: "codeEdit"; source: string }
  | { type: "codeResults"; results: CodeTestResult[] }
  | { type: "codeReset" }
  | { type: "nextStage" }
  | { type: "bossAnswer"; question: number; choice: number }
  | { type: "toRecall" }
  | { type: "recallToggleNode"; name: string }
  | { type: "recallAddEdge"; from: string; to: string; relation: string }
  | { type: "recallRemoveEdge"; index: number }
  | { type: "recallCloze"; blank: number; word: string | null }
  | { type: "recallConfidence"; confidence: Confidence }
  | { type: "recallSubmit" }
  | { type: "finish"; at: string }
  | { type: "hint" };

// ---------------- Helpers shared with the UI ----------------

/**
 * Reads a record keyed by content ids. Ids like "constructor" or "toString" would otherwise hit
 * Object.prototype, so only the record's own keys count.
 */
export function own<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** Deterministic shuffle that never returns the original order (for 2+ items). */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const random = createRandom(h >>> 0);
  const out = [...items];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.length < 2 || out.some((item, i) => item !== items[i])) return out;
  }
  return [...out.slice(1), out[0]];
}

export function riftShape(rift: Rift): string {
  const parts = rift.play.map((s) => {
    switch (s.kind) {
      case "steps":
        return `steps:${s.steps.length}`;
      case "sort":
        return `sort:${s.items.map((i) => i.id).join(",")}`;
      case "order":
        return `order:${s.items.map((i) => i.id).join(",")}`;
      case "estimate":
        return `estimate:${s.questions.map((q) => q.id).join(",")}`;
      case "sim":
        return `sim:${s.sim.waves.length}`;
      case "lab":
        return `lab:${s.widget}`;
      case "code":
        return `code:${s.tests.length}`;
    }
  });
  const recall = rift.recall.kind === "cloze" ? `cloze:${clozeParts(rift.recall.text).filter((p) => p.kind === "blank").length}` : "blueprint";
  return [...parts, `boss:${rift.boss.questions.length}`, recall].join("|");
}

function initialStage(stage: Stage, levelId: string, index: number): StageState {
  switch (stage.kind) {
    case "steps":
      return { kind: "steps", step: 0, wrong: [], done: false };
    case "sort":
      return { kind: "sort", placed: {}, checked: false, done: false };
    case "order":
      return { kind: "order", order: seededShuffle(stage.items.map((i) => i.id), `${levelId}#${index}`), checked: false, done: false };
    case "estimate":
      return { kind: "estimate", answers: {}, solved: [], done: false };
    case "sim":
      return { kind: "sim", config: stage.sim.start, wave: 0, runs: 0, lastPassed: null, done: false };
    case "lab":
      return { kind: "lab", data: null, done: false };
    case "code":
      return { kind: "code", source: stage.starter, results: null, runs: 0, done: false };
  }
}

export function initialRiftState(levelId: string, rift: Rift, now: string): RiftState {
  const blanks = rift.recall.kind === "cloze" ? clozeParts(rift.recall.text).filter((p) => p.kind === "blank").length : 0;
  return {
    shape: riftShape(rift),
    beat: "pain",
    painTried: [],
    stage: 0,
    stages: rift.play.map((s, i) => initialStage(s, levelId, i)),
    boss: { answers: rift.boss.questions.map(() => null) },
    recall: { graph: { nodes: [], edges: [] }, cloze: new Array(blanks).fill(null), confidence: null, submitted: false },
    hintsUsed: 0,
    missteps: 0,
    feedback: null,
    startedAt: now,
    finishedAt: null,
  };
}

export function estimateAccepted(answer: number, value: number, tolerance: number): boolean {
  return value > 0 && value >= answer / tolerance && value <= answer * tolerance;
}

export type RecallResult =
  | { kind: "blueprint"; diff: GraphDiff; score: number; passed: boolean }
  | { kind: "cloze"; correct: boolean[]; score: number; passed: boolean };

export function recallResult(rift: Rift, state: RiftState): RecallResult {
  const recall = rift.recall;
  if (recall.kind === "blueprint") {
    const diff = diffGraphs(recall.reference, state.recall.graph, { aliases: recall.aliases, acceptedExtras: recall.acceptedExtras });
    const { concepts, relationships, types } = diff.scores;
    const precision = diff.nodes.invalidExtra.length === 0 && diff.edges.invalidExtra.length === 0;
    const score = (concepts + relationships + types) / 3;
    return { kind: "blueprint", diff, score, passed: concepts >= 0.8 && relationships >= 0.8 && types >= 0.8 && (precision || score >= 0.95) };
  }
  const blanks = clozeParts(recall.text).filter((p) => p.kind === "blank");
  const correct = blanks.map((b, i) => {
    const chosen = state.recall.cloze[i];
    return b.kind === "blank" && chosen !== null && chosen !== undefined && b.answers.some((a) => a.toLowerCase() === chosen.toLowerCase());
  });
  const score = correct.length === 0 ? 1 : correct.filter(Boolean).length / correct.length;
  return { kind: "cloze", correct, score, passed: score >= 0.8 };
}

export function bossScore(rift: Rift, state: RiftState) {
  const right = rift.boss.questions.filter((q, i) => {
    const a = state.boss.answers[i];
    return a !== null && a !== undefined && q.choices[a]?.correct;
  }).length;
  return { right, total: rift.boss.questions.length };
}

/** XP for a finished rift: base by difficulty, bonuses for clean play (PRD: Rewards). */
export function riftXp(rift: Rift, state: RiftState, difficulty: number) {
  const base = 60 + difficulty * 40;
  const boss = bossScore(rift, state);
  const recall = recallResult(rift, state);
  const parts = [
    { label: "Rift sealed", xp: base },
    { label: `Boss: ${boss.right}/${boss.total}`, xp: Math.round((boss.right / boss.total) * 50) },
    { label: `Recall: ${Math.round(recall.score * 100)}%`, xp: Math.round(recall.score * 50) },
    ...(state.hintsUsed === 0 ? [{ label: "No hints", xp: 20 }] : []),
    ...(state.missteps === 0 ? [{ label: "Flawless", xp: 30 }] : []),
  ];
  return { parts, total: parts.reduce((sum, p) => sum + p.xp, 0) };
}

// ---------------- Reducer ----------------

export function createRiftReducer(levelId: string, rift: Rift) {
  return function reduce(state: RiftState, action: RiftAction): RiftState {
    const stage = rift.play[state.stage];
    const current = state.stages[state.stage];
    const setStage = (next: StageState, extra: Partial<RiftState> = {}): RiftState => ({
      ...state,
      ...extra,
      stages: state.stages.map((s, i) => (i === state.stage ? next : s)),
    });

    switch (action.type) {
      case "painTry": {
        const option = rift.pain.options[action.option];
        if (!option || state.beat !== "pain") return state;
        const tried = state.painTried.includes(action.option) ? state.painTried : [...state.painTried, action.option];
        return { ...state, painTried: tried, feedback: { tone: "bad", text: option.outcome } };
      }
      case "toPlay":
        if (state.beat !== "pain" || state.painTried.length === 0) return state;
        return { ...state, beat: "play", feedback: null };

      case "stepChoose": {
        if (stage?.kind !== "steps" || current.kind !== "steps" || current.done) return state;
        const step = stage.steps[current.step];
        const option = step.options[action.option];
        if (!option) return state;
        if (!option.correct) {
          if (current.wrong.includes(action.option)) return state;
          return setStage({ ...current, wrong: [...current.wrong, action.option] }, { missteps: state.missteps + 1, feedback: { tone: "bad", text: option.feedback } });
        }
        const last = current.step === stage.steps.length - 1;
        return setStage(
          { ...current, step: last ? current.step : current.step + 1, wrong: [], done: last },
          { feedback: { tone: "good", text: option.feedback } },
        );
      }

      case "sortPlace": {
        if (current?.kind !== "sort" || current.done) return state;
        const placed = { ...current.placed };
        if (action.bucket === null) delete placed[action.item];
        else placed[action.item] = action.bucket;
        return setStage({ ...current, placed, checked: false }, { feedback: null });
      }
      case "sortCheck": {
        if (stage?.kind !== "sort" || current.kind !== "sort") return state;
        const wrong = stage.items.filter((i) => own(current.placed, i.id) !== i.bucket);
        if (wrong.length === 0) {
          return setStage({ ...current, checked: true, done: true }, { feedback: { tone: "good", text: "Every item is in the right place." } });
        }
        const unplaced = stage.items.filter((i) => !own(current.placed, i.id)).length;
        return setStage(
          { ...current, checked: true },
          {
            missteps: state.missteps + 1,
            feedback: {
              tone: "bad",
              text: unplaced > 0 ? `${unplaced} still to place.` : `${wrong.length} ${wrong.length === 1 ? "item is" : "items are"} in the wrong place. They're marked.`,
            },
          },
        );
      }

      case "orderMove": {
        if (current?.kind !== "order" || current.done) return state;
        const order = current.order.filter((id) => id !== action.item);
        order.splice(Math.max(0, Math.min(action.to, order.length)), 0, action.item);
        return setStage({ ...current, order, checked: false }, { feedback: null });
      }
      case "orderSet": {
        if (current?.kind !== "order" || current.done) return state;
        const same = action.order.length === current.order.length && action.order.every((id) => current.order.includes(id));
        if (!same) return state;
        return setStage({ ...current, order: action.order, checked: false }, { feedback: null });
      }
      case "orderCheck": {
        if (stage?.kind !== "order" || current.kind !== "order") return state;
        const right = current.order.filter((id, i) => stage.items[i].id === id).length;
        if (right === stage.items.length) {
          return setStage({ ...current, checked: true, done: true }, { feedback: { tone: "good", text: "That's the right order." } });
        }
        return setStage(
          { ...current, checked: true },
          { missteps: state.missteps + 1, feedback: { tone: "bad", text: `${right} of ${stage.items.length} are in the right position.` } },
        );
      }

      case "estimateAnswer": {
        if (current?.kind !== "estimate" || current.solved.includes(action.question)) return state;
        return setStage({ ...current, answers: { ...current.answers, [action.question]: action.value } }, { feedback: null });
      }
      case "estimateCheck": {
        if (stage?.kind !== "estimate" || current.kind !== "estimate") return state;
        const q = stage.questions.find((x) => x.id === action.question);
        const value = own(current.answers, action.question);
        if (!q || value === null || value === undefined || current.solved.includes(q.id)) return state;
        if (estimateAccepted(q.answer, value, q.tolerance)) {
          const solved = [...current.solved, q.id];
          return setStage(
            { ...current, solved, done: solved.length === stage.questions.length },
            { feedback: { tone: "good", text: `Close enough for a whiteboard. ${q.working}` } },
          );
        }
        const high = value > q.answer;
        return setStage(current, {
          missteps: state.missteps + 1,
          feedback: { tone: "bad", text: `That's ${high ? "too high" : "too low"} by more than ${q.tolerance}×. Check your units and try again.` },
        });
      }

      case "simSet": {
        if (current?.kind !== "sim" || current.done) return state;
        return setStage({ ...current, config: action.config, lastPassed: null }, { feedback: null });
      }
      case "simRun": {
        if (stage?.kind !== "sim" || current.kind !== "sim" || current.done) return state;
        const wave = stage.sim.waves[current.wave];
        const result = simulate(current.config, wave, stage.sim.goals);
        if (!result.passed) {
          return setStage(
            { ...current, runs: current.runs + 1, lastPassed: false },
            { missteps: state.missteps + 1, feedback: { tone: "bad", text: result.findings[0] ?? "The goals aren't met yet." } },
          );
        }
        const last = current.wave === stage.sim.waves.length - 1;
        return setStage(
          { ...current, runs: current.runs + 1, wave: last ? current.wave : current.wave + 1, lastPassed: true, done: last },
          {
            feedback: {
              tone: "good",
              text: last ? `${wave.name} survived. The system holds.` : `${wave.name} survived. Brace for the next wave: ${stage.sim.waves[current.wave + 1].name}.`,
            },
          },
        );
      }

      case "labUpdate":
        if (current?.kind !== "lab" || current.done) return state;
        return setStage({ ...current, data: action.data });
      case "labDone":
        if (current?.kind !== "lab" || current.done) return state;
        return setStage({ ...current, done: true }, { feedback: { tone: "good", text: "Lab complete." } });

      case "codeEdit":
        if (current?.kind !== "code" || current.done) return state;
        return setStage({ ...current, source: action.source, results: null }, { feedback: null });
      case "codeReset":
        if (stage?.kind !== "code" || current?.kind !== "code" || current.done) return state;
        return setStage({ ...current, source: stage.starter, results: null }, { feedback: null });
      case "codeResults": {
        if (stage?.kind !== "code" || current?.kind !== "code" || current.done) return state;
        const results = action.results;
        const passed = results.length === stage.tests.length && results.every((r) => r.passed);
        if (passed) {
          return setStage({ ...current, results, runs: current.runs + 1, done: true }, { feedback: { tone: "good", text: `All ${results.length} tests pass. Your code works.` } });
        }
        const failing = results.filter((r) => !r.passed);
        const first = failing[0];
        return setStage(
          { ...current, results, runs: current.runs + 1 },
          {
            missteps: state.missteps + 1,
            feedback: { tone: "bad", text: `${results.length - failing.length} of ${results.length} tests pass.${first ? ` First failure, “${first.name}”: ${first.message}` : ""}` },
          },
        );
      }

      case "nextStage": {
        if (state.beat !== "play" || !current?.done) return state;
        if (state.stage < rift.play.length - 1) return { ...state, stage: state.stage + 1, feedback: null };
        return { ...state, beat: "proof", feedback: null };
      }

      case "bossAnswer": {
        if (state.beat !== "proof") return state;
        const q = rift.boss.questions[action.question];
        if (!q || state.boss.answers[action.question] !== null || !q.choices[action.choice]) return state;
        // Questions are answered in order.
        if (state.boss.answers.findIndex((a) => a === null) !== action.question) return state;
        const answers = state.boss.answers.map((a, i) => (i === action.question ? action.choice : a));
        const choice = q.choices[action.choice];
        return {
          ...state,
          boss: { answers },
          missteps: state.missteps + (choice.correct ? 0 : 1),
          feedback: { tone: choice.correct ? "good" : "bad", text: choice.why },
        };
      }
      case "toRecall":
        if (state.beat !== "proof" || state.boss.answers.some((a) => a === null)) return state;
        return { ...state, beat: "recall", feedback: null };

      case "recallToggleNode": {
        if (state.beat !== "recall" || state.recall.submitted) return state;
        const { graph } = state.recall;
        const on = graph.nodes.includes(action.name);
        const nodes = on ? graph.nodes.filter((n) => n !== action.name) : [...graph.nodes, action.name];
        const edges = on ? graph.edges.filter((e) => e.from !== action.name && e.to !== action.name) : graph.edges;
        return { ...state, recall: { ...state.recall, graph: { nodes, edges } } };
      }
      case "recallAddEdge": {
        if (state.beat !== "recall" || state.recall.submitted || action.from === action.to) return state;
        const { graph } = state.recall;
        if (!graph.nodes.includes(action.from) || !graph.nodes.includes(action.to)) return state;
        const edges = graph.edges.filter((e) => !(e.from === action.from && e.to === action.to));
        return { ...state, recall: { ...state.recall, graph: { nodes: graph.nodes, edges: [...edges, { from: action.from, to: action.to, type: action.relation }] } } };
      }
      case "recallRemoveEdge": {
        if (state.beat !== "recall" || state.recall.submitted) return state;
        const { graph } = state.recall;
        return { ...state, recall: { ...state.recall, graph: { ...graph, edges: graph.edges.filter((_, i) => i !== action.index) } } };
      }
      case "recallCloze": {
        if (state.beat !== "recall" || state.recall.submitted) return state;
        const cloze = state.recall.cloze.map((w, i) => (i === action.blank ? action.word : w));
        return { ...state, recall: { ...state.recall, cloze } };
      }
      case "recallConfidence":
        if (state.beat !== "recall" || state.recall.submitted) return state;
        return { ...state, recall: { ...state.recall, confidence: action.confidence } };
      case "recallSubmit": {
        if (state.beat !== "recall" || state.recall.submitted || state.recall.confidence === null) return state;
        const empty = rift.recall.kind === "blueprint" ? state.recall.graph.nodes.length === 0 : state.recall.cloze.every((w) => w === null);
        if (empty) return state;
        return { ...state, recall: { ...state.recall, submitted: true }, feedback: null };
      }
      case "finish":
        if (state.beat !== "recall" || !state.recall.submitted) return state;
        return { ...state, beat: "reward", finishedAt: action.at, feedback: null };

      case "hint": {
        const text = hintFor(rift, state);
        if (!text) return state;
        return { ...state, hintsUsed: state.hintsUsed + 1, feedback: { tone: "info", text } };
      }
    }
  };
}

function hintFor(rift: Rift, state: RiftState): string | null {
  if (state.beat === "pain") return "Try any option: in this beat, every choice shows you how the current design breaks.";
  if (state.beat === "proof") return `Think about the trade-off, not the definition. ${rift.codex.interviewTells[0] ?? ""}`.trim();
  if (state.beat === "recall") {
    if (rift.recall.kind === "blueprint") {
      const missing = rift.recall.reference.nodes.find((n) => !state.recall.graph.nodes.includes(n));
      return missing ? `One piece you need: ${missing}.` : "All the pieces are there. Check the direction and type of each arrow.";
    }
    return `The key idea: ${rift.codex.oneLiner}`;
  }
  if (state.beat !== "play") return null;
  const stage = rift.play[state.stage];
  const current = state.stages[state.stage];
  if (stage.kind === "steps" && current.kind === "steps") {
    const step = stage.steps[current.step];
    const wrong = step.options.findIndex((o, i) => !o.correct && !current.wrong.includes(i));
    return wrong >= 0 ? `It's not “${step.options[wrong].text}”.` : null;
  }
  if (stage.kind === "sort" && current.kind === "sort") {
    const item = stage.items.find((i) => own(current.placed, i.id) !== i.bucket);
    const bucket = stage.buckets.find((b) => b.id === item?.bucket);
    return item && bucket ? `“${item.text}” belongs in ${bucket.label}.` : null;
  }
  if (stage.kind === "order" && current.kind === "order") {
    const i = stage.items.findIndex((item, idx) => current.order[idx] !== item.id);
    return i >= 0 ? `Position ${i + 1} should be: “${stage.items[i].text}”.` : null;
  }
  if (stage.kind === "estimate" && current.kind === "estimate") {
    const q = stage.questions.find((x) => !current.solved.includes(x.id));
    return q ? `Work it through: ${q.working}` : null;
  }
  if (stage.kind === "sim" && current.kind === "sim") {
    const result = simulate(current.config, stage.sim.waves[current.wave], stage.sim.goals);
    return result.findings[0] ? `Bottleneck: ${result.findings[0]}` : "Everything looks healthy. Run the wave.";
  }
  if (stage.kind === "lab") return "Follow the goals on the right of the lab, one at a time.";
  if (stage.kind === "code" && current.kind === "code") {
    const failing = current.results?.find((r) => !r.passed);
    if (stage.hint && (!failing || current.runs < 2)) return stage.hint;
    return failing ? `Focus on “${failing.name}”: ${failing.message}` : "Run the tests to see what's left.";
  }
  return null;
}

// ---------------- Snapshot codec ----------------

const StageStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("steps"), step: z.number().int().min(0), wrong: z.array(z.number().int()), done: z.boolean() }),
  z.object({ kind: z.literal("sort"), placed: z.record(z.string(), z.string()), checked: z.boolean(), done: z.boolean() }),
  z.object({ kind: z.literal("order"), order: z.array(z.string()), checked: z.boolean(), done: z.boolean() }),
  z.object({ kind: z.literal("estimate"), answers: z.record(z.string(), z.number().nullable()), solved: z.array(z.string()), done: z.boolean() }),
  z.object({ kind: z.literal("sim"), config: SimConfigSchema, wave: z.number().int().min(0), runs: z.number().int().min(0), lastPassed: z.boolean().nullable(), done: z.boolean() }),
  z.object({ kind: z.literal("lab"), data: z.unknown(), done: z.boolean() }),
  z.object({
    kind: z.literal("code"),
    source: z.string(),
    results: z.array(z.object({ name: z.string(), passed: z.boolean(), message: z.string() })).nullable(),
    runs: z.number().int().min(0),
    done: z.boolean(),
  }),
]);

const RiftStateSchema = z.object({
  shape: z.string(),
  beat: z.enum(["pain", "play", "proof", "recall", "reward"]),
  painTried: z.array(z.number().int()),
  stage: z.number().int().min(0),
  stages: z.array(StageStateSchema),
  boss: z.object({ answers: z.array(z.number().int().nullable()) }),
  recall: z.object({
    graph: z.object({ nodes: z.array(z.string()), edges: z.array(z.object({ from: z.string(), to: z.string(), type: z.string() })) }),
    cloze: z.array(z.string().nullable()),
    confidence: z.enum(["sure", "unsure", "guessing"]).nullable(),
    submitted: z.boolean(),
  }),
  hintsUsed: z.number().int().min(0),
  missteps: z.number().int().min(0),
  feedback: z.object({ tone: z.enum(["good", "bad", "info"]), text: z.string() }).nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});

export const RIFT_SCHEMA_VERSION = 1;

export function createRiftCodec(rift: Rift): SnapshotCodec<RiftState> {
  const shape = riftShape(rift);
  return {
    currentVersion: RIFT_SCHEMA_VERSION,
    migrate(state, fromVersion) {
      if (fromVersion !== RIFT_SCHEMA_VERSION) return null;
      const parsed = RiftStateSchema.safeParse(state);
      if (!parsed.success) return null;
      const s = parsed.data as RiftState;
      // The level's content changed shape since this save: the old progress no longer lines up.
      if (s.shape !== shape || s.stages.length !== rift.play.length || s.stage >= rift.play.length) return null;
      if (s.stages.some((st, i) => st.kind !== rift.play[i].kind)) return null;
      return s;
    },
  };
}
