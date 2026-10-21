import { z } from "zod";
import { diffGraphs, type Graph, type GraphDiff } from "@/engine/memory/graphDiff";
import type { SnapshotCodec } from "@/persistence/repository";
import { LEGACY_OFFERS, OFFERS, PROOF_OFFERS, type OfferId } from "./domain";
import { LEGACY_DESIGN, applyMove, hydraHeads, type Design, type Move } from "./design";

export const LEVEL_ID = "lld-strategy-hydra";
export const SCHEMA_VERSION = 1;

export type Beat = "pain" | "play" | "proof" | "recall" | "reward";
export type Confidence = "sure" | "unsure" | "guessing";
export type Tone = "good" | "bad" | "info";

/**
 * Everything needed to resume the level exactly where the learner left it (PRD: Persistence and
 * resume). Transient UI details such as the active lens or hover state are deliberately not here.
 */
export interface HydraState {
  beat: Beat;
  design: Design;
  /** Offers the café owner has asked for; their scenarios are the acceptance tests. */
  requested: OfferId[];
  painTries: number[];
  missteps: number;
  hintsUsed: number;
  feedback: { tone: Tone; text: string } | null;
  proof: { arrived: number; startedAt: string | null; seconds: number | null; answer: string | null };
  recall: { graph: Graph; confidence: Confidence | null; diff: GraphDiff | null };
  elaboration: string | null;
  startedAt: string;
}

export function initialState(now: string): HydraState {
  return {
    beat: "pain",
    design: LEGACY_DESIGN,
    requested: [...LEGACY_OFFERS, "festival"],
    painTries: [],
    missteps: 0,
    hintsUsed: 0,
    feedback: null,
    proof: { arrived: 0, startedAt: null, seconds: null, answer: null },
    recall: { graph: { nodes: [], edges: [] }, confidence: null, diff: null },
    elaboration: null,
    startedAt: now,
  };
}

// ---------------- Recall reference ----------------

export const REFERENCE: Graph = {
  nodes: ["Checkout", "PricingStrategy", "StudentPricing", "LoyaltyPricing", "HappyHourPricing", "FestivalPricing"],
  edges: [
    { from: "Checkout", to: "PricingStrategy", type: "uses" },
    ...["StudentPricing", "LoyaltyPricing", "HappyHourPricing", "FestivalPricing"].map((from) => ({ from, to: "PricingStrategy", type: "implements" })),
  ],
};

const PROOF_CLASSES = PROOF_OFFERS.map((id) => OFFERS[id].className);
export const RECALL_OPTIONS = {
  acceptedExtras: {
    nodes: PROOF_CLASSES,
    edges: PROOF_CLASSES.map((from) => ({ from, to: "PricingStrategy", type: "implements" })),
  },
  aliases: { PricingStrategy: ["DiscountStrategy", "IPricingStrategy"] },
};

/** Classes offered in the Blank Blueprint palette: the real ones plus plausible distractors. */
export const RECALL_PALETTE = [
  "HappyHourPricing",
  "PriceCalculatorUtil",
  "Checkout",
  "FestivalCheckout",
  "StudentPricing",
  "PricingStrategy",
  "MonsoonPricing",
  "StudentCheckout",
  "LoyaltyPricing",
  "FestivalPricing",
];
export const RELATIONS = ["uses", "implements", "extends"] as const;

export function recallPassed(diff: GraphDiff): boolean {
  return diff.scores.concepts >= 0.8 && diff.scores.relationships >= 0.8 && diff.scores.types >= 0.8;
}

// ---------------- Questions ----------------

export interface Choice {
  id: string;
  text: string;
  correct: boolean;
  why: string;
}

export const INTERVIEW_QUESTION = {
  prompt: "Interviewer: “When would you NOT use Strategy here?”",
  choices: [
    { id: "stable", text: "When there are only two stable rules that rarely change", correct: true, why: "Right. A plain conditional is clearer when variation is small and stable; Strategy earns its classes when rules keep arriving." },
    { id: "runtime", text: "When the pricing rule has to be picked at runtime, per customer", correct: false, why: "That is exactly when Strategy helps: swapping behaviour at runtime is its core use." },
    { id: "often", text: "When the business adds a new offer every month or so", correct: false, why: "Frequent new variants are the strongest reason to use Strategy, not avoid it." },
    { id: "interfaces", text: "Whenever the rules have to sit behind a shared interface", correct: false, why: "Interfaces are how Strategy works; they are not a reason to avoid it." },
  ] satisfies Choice[],
};

export const ELABORATION_QUESTION = {
  prompt: "In your own understanding: why did the festival offer need no edits to old code?",
  choices: [
    { id: "interface", text: "Checkout depends only on the PricingStrategy interface, so a new class plugs in without changing it", correct: true, why: "Exactly. Depending on an abstraction is what keeps Checkout closed for modification and open for extension." },
    { id: "copied", text: "FestivalPricing copied Checkout's code, so the original Checkout never needed to be touched", correct: false, why: "Copying would create the Clone Army smell. FestivalPricing contains only its own rule." },
    { id: "bottom", text: "The festival branch went at the bottom of the if-else chain, below every older rule", correct: false, why: "No position in the chain worked; the chain itself was removed." },
    { id: "language", text: "TypeScript lets you attach a new method to Checkout at runtime without editing it", correct: false, why: "No language trick is involved; this works the same way in Java." },
  ] satisfies Choice[],
};

// ---------------- Hints ----------------

export function nextHint(state: HydraState): string {
  const d = state.design;
  switch (state.beat) {
    case "pain":
      return "Try a few positions. Watch which test fails each time: the chain applies the FIRST matching offer, but the café wants the BEST one.";
    case "play":
      if (!d.interfaceExtracted) return "Start by giving every pricing rule a common shape: extract a PricingStrategy interface.";
      if (d.chain.some((e) => !e.extracted)) return "Cut the remaining heads: move each inline branch into its own class.";
      if (!d.injected) return "Now let Checkout receive a list of strategies and apply the best discount, instead of walking an if-else chain.";
      return "Add the festival rule without touching Checkout: what kind of thing does Checkout already accept?";
    case "proof":
      return "Each new offer is just another PricingStrategy. Add a class; leave Checkout alone.";
    case "recall":
      return "Checkout uses one interface. How many classes implement it, and with which arrow?";
    case "reward":
      return "You're done. Come back for your first review when it's due.";
  }
}

// ---------------- Reducer ----------------

export type Action =
  | { type: "painInsert"; position: number }
  | { type: "toPlay" }
  | { type: "move"; move: Move }
  | { type: "distractor"; text: string }
  | { type: "addFestival"; how: "class" | "edit" }
  | { type: "hint" }
  | { type: "dismissFeedback" }
  | { type: "startProof"; at: string }
  | { type: "proofAdd"; how: "class" | "edit"; at: string }
  | { type: "answerInterview"; choiceId: string }
  | { type: "toRecall" }
  | { type: "recallAddNode"; name: string }
  | { type: "recallRemoveNode"; name: string }
  | { type: "recallAddEdge"; from: string; to: string; relation: string }
  | { type: "recallRemoveEdge"; index: number }
  | { type: "recallConfidence"; confidence: Confidence }
  | { type: "recallSubmit" }
  | { type: "elaborate"; choiceId: string }
  | { type: "finish" };

const say = (tone: Tone, text: string) => ({ tone, text });

export function reduce(state: HydraState, action: Action): HydraState {
  switch (action.type) {
    case "painInsert": {
      if (state.beat !== "pain") return state;
      const result = applyMove(LEGACY_DESIGN, { type: "insertBranch", offer: "festival", position: action.position });
      if (!result.ok) return state;
      return {
        ...state,
        design: result.design,
        painTries: [...state.painTries, action.position],
        feedback: say("bad", "The new branch fixed one festival case and broke another. Another head grows."),
      };
    }
    case "toPlay":
      if (state.beat !== "pain" || state.painTries.length === 0) return state;
      return { ...state, beat: "play", design: LEGACY_DESIGN, feedback: say("info", "Back to the original code. This time, cut the heads instead of adding them.") };
    case "move": {
      if (state.beat !== "play") return state;
      const before = hydraHeads(state.design);
      const result = applyMove(state.design, action.move);
      if (!result.ok) return { ...state, missteps: state.missteps + 1, feedback: say("bad", result.reason) };
      const after = hydraHeads(result.design);
      const text =
        action.move.type === "injectStrategies"
          ? "The Hydra falls. Checkout now asks every strategy and applies the best one. All tests still green."
          : after < before
            ? "Head cut. It won't grow back: the rule now lives in its own class."
            : "PricingStrategy extracted: every pricing rule now shares one shape.";
      return { ...state, design: result.design, feedback: say("good", text) };
    }
    case "distractor":
      if (state.beat !== "play") return state;
      return { ...state, missteps: state.missteps + 1, feedback: say("bad", action.text) };
    case "addFestival": {
      if (state.beat !== "play" || !state.design.injected || state.design.strategies.includes("festival")) return state;
      if (action.how === "edit") {
        return {
          ...state,
          missteps: state.missteps + 1,
          feedback: say("bad", "Tests pass, but you edited Checkout, a finished and tested class. The Open/Closed check fails. Undo and try again without touching it."),
        };
      }
      const result = applyMove(state.design, { type: "addStrategyClass", offer: "festival" });
      if (!result.ok) return state;
      return {
        ...state,
        beat: "proof",
        design: result.design,
        feedback: say("good", "FestivalPricing added as one new class. Zero edits to existing code, and every test is green. That is the Open/Closed principle."),
      };
    }
    case "dismissFeedback":
      return { ...state, feedback: null };
    case "hint":
      return { ...state, hintsUsed: state.hintsUsed + 1, feedback: say("info", nextHint(state)) };
    case "startProof":
      if (state.beat !== "proof" || state.proof.startedAt) return state;
      return { ...state, proof: { ...state.proof, startedAt: action.at }, feedback: null };
    case "proofAdd": {
      if (state.beat !== "proof" || state.proof.arrived >= PROOF_OFFERS.length) return state;
      const offer = PROOF_OFFERS[state.proof.arrived];
      if (action.how === "edit") {
        return { ...state, missteps: state.missteps + 1, feedback: say("bad", `Editing Checkout again would break Open/Closed. Add ${OFFERS[offer].className} instead.`) };
      }
      const result = applyMove(state.design, { type: "addStrategyClass", offer });
      if (!result.ok) return state;
      const arrived = state.proof.arrived + 1;
      const done = arrived === PROOF_OFFERS.length;
      const seconds =
        done && state.proof.startedAt ? Math.round((Date.parse(action.at) - Date.parse(state.proof.startedAt)) / 1000) : state.proof.seconds;
      return {
        ...state,
        design: result.design,
        requested: [...state.requested, offer],
        proof: { ...state.proof, arrived, seconds },
        feedback: say("good", `${OFFERS[offer].className} added. Every test still green.`),
      };
    }
    case "answerInterview": {
      if (state.beat !== "proof" || state.proof.arrived < PROOF_OFFERS.length || state.proof.answer) return state;
      const choice = INTERVIEW_QUESTION.choices.find((c) => c.id === action.choiceId);
      if (!choice) return state;
      return { ...state, proof: { ...state.proof, answer: choice.id }, feedback: say(choice.correct ? "good" : "bad", choice.why) };
    }
    case "toRecall":
      if (state.beat !== "proof" || !state.proof.answer) return state;
      return { ...state, beat: "recall", feedback: null };
    case "recallAddNode": {
      if (state.beat !== "recall" || state.recall.diff || state.recall.graph.nodes.includes(action.name)) return state;
      return withGraph(state, { ...state.recall.graph, nodes: [...state.recall.graph.nodes, action.name] });
    }
    case "recallRemoveNode": {
      if (state.beat !== "recall" || state.recall.diff) return state;
      const g = state.recall.graph;
      return withGraph(state, {
        nodes: g.nodes.filter((n) => n !== action.name),
        edges: g.edges.filter((e) => e.from !== action.name && e.to !== action.name),
      });
    }
    case "recallAddEdge": {
      if (state.beat !== "recall" || state.recall.diff || action.from === action.to) return state;
      const g = state.recall.graph;
      if (!g.nodes.includes(action.from) || !g.nodes.includes(action.to)) return state;
      if (g.edges.some((e) => e.from === action.from && e.to === action.to)) return state;
      return withGraph(state, { ...g, edges: [...g.edges, { from: action.from, to: action.to, type: action.relation }] });
    }
    case "recallRemoveEdge": {
      if (state.beat !== "recall" || state.recall.diff) return state;
      const g = state.recall.graph;
      return withGraph(state, { ...g, edges: g.edges.filter((_, i) => i !== action.index) });
    }
    case "recallConfidence":
      if (state.beat !== "recall" || state.recall.diff) return state;
      return { ...state, recall: { ...state.recall, confidence: action.confidence } };
    case "recallSubmit": {
      if (state.beat !== "recall" || state.recall.diff || !state.recall.confidence || state.recall.graph.nodes.length === 0) return state;
      const diff = diffGraphs(REFERENCE, state.recall.graph, RECALL_OPTIONS);
      return {
        ...state,
        recall: { ...state.recall, diff },
        feedback: recallPassed(diff)
          ? say("good", "Rebuilt from memory. That retrieval is what makes it stick.")
          : say("bad", "Some pieces slipped. Look at what is missing and why; this card will come back sooner."),
      };
    }
    case "elaborate": {
      if (state.beat !== "recall" || !state.recall.diff || state.elaboration) return state;
      const choice = ELABORATION_QUESTION.choices.find((c) => c.id === action.choiceId);
      if (!choice) return state;
      return { ...state, elaboration: choice.id, feedback: say(choice.correct ? "good" : "bad", choice.why) };
    }
    case "finish":
      if (state.beat !== "recall" || !state.elaboration) return state;
      return { ...state, beat: "reward", feedback: null };
  }
}

function withGraph(state: HydraState, graph: Graph): HydraState {
  return { ...state, recall: { ...state.recall, graph } };
}

// ---------------- Snapshot schema ----------------

const offerId = z.enum(["student", "loyalty", "happyHour", "festival", "monsoon", "combo", "firstOrder"]);
const edge = z.object({ from: z.string(), to: z.string(), type: z.string() });

const StateSchema = z.object({
  beat: z.enum(["pain", "play", "proof", "recall", "reward"]),
  design: z.object({
    interfaceExtracted: z.boolean(),
    chain: z.array(z.object({ offer: offerId, extracted: z.boolean() })),
    injected: z.boolean(),
    strategies: z.array(offerId),
    inlineAdditions: z.array(offerId),
  }),
  requested: z.array(offerId),
  painTries: z.array(z.number().int()),
  missteps: z.number().int().min(0),
  hintsUsed: z.number().int().min(0),
  feedback: z.object({ tone: z.enum(["good", "bad", "info"]), text: z.string() }).nullable(),
  proof: z.object({
    arrived: z.number().int().min(0).max(PROOF_OFFERS.length),
    startedAt: z.string().nullable(),
    seconds: z.number().nullable(),
    answer: z.string().nullable(),
  }),
  recall: z.object({
    graph: z.object({ nodes: z.array(z.string()), edges: z.array(edge) }),
    confidence: z.enum(["sure", "unsure", "guessing"]).nullable(),
    diff: z.any().nullable(),
  }),
  elaboration: z.string().nullable(),
  startedAt: z.string(),
});

/** Validates saved state; future schema versions add migration steps here. */
export const hydraCodec: SnapshotCodec<HydraState> = {
  currentVersion: SCHEMA_VERSION,
  migrate(state, fromVersion) {
    if (fromVersion !== 1) return null;
    const parsed = StateSchema.safeParse(state);
    return parsed.success ? (parsed.data as HydraState) : null;
  },
};
