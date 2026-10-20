import { OFFERS, SCENARIOS, specTotal, subtotal, type OfferId, type Order } from "./domain";

/**
 * The player's design of Checkout. Refactoring moves transform it; `compile` turns it into a
 * runnable pricing function, so the harness judges behaviour, not how the diagram looks.
 */
export interface ChainEntry {
  offer: OfferId;
  /** True once the branch has been moved into its own PricingStrategy class. */
  extracted: boolean;
}

export interface Design {
  interfaceExtracted: boolean;
  /** Checkout's if-else chain, first match wins, while `injected` is false. */
  chain: ChainEntry[];
  /** Once true, Checkout asks every injected strategy and applies the best discount. */
  injected: boolean;
  /** Strategies plugged into Checkout after injection (each its own class). */
  strategies: OfferId[];
  /** Offers added by editing the finished Checkout instead of adding a class (Open/Closed violations). */
  inlineAdditions: OfferId[];
}

export const LEGACY_DESIGN: Design = {
  interfaceExtracted: false,
  chain: [
    { offer: "student", extracted: false },
    { offer: "loyalty", extracted: false },
    { offer: "happyHour", extracted: false },
  ],
  injected: false,
  strategies: [],
  inlineAdditions: [],
};

/** Every offer the design implements, in any form. */
export function offersIn(design: Design): OfferId[] {
  return design.injected ? [...design.strategies, ...design.inlineAdditions] : design.chain.map((e) => e.offer);
}

/** Turns the design into the pricing function it actually implements. */
export function compile(design: Design): (order: Order) => number {
  if (design.injected) {
    return (order) => {
      const discounts = [...design.strategies, ...design.inlineAdditions].map((id) => OFFERS[id]).filter((s) => s.applies(order)).map((s) => s.discount(order));
      return Math.max(0, subtotal(order) - Math.max(0, ...discounts));
    };
  }
  return (order) => {
    // An if-else chain: the first branch whose condition matches wins, even if a later one is better.
    for (const { offer } of design.chain) {
      const o = OFFERS[offer];
      if (o.applies(order)) return Math.max(0, subtotal(order) - o.discount(order));
    }
    return subtotal(order);
  };
}

/** Number of Hydra heads: branches still living inline in Checkout's if-else chain. */
export function hydraHeads(design: Design): number {
  return design.injected ? 0 : design.chain.filter((e) => !e.extracted).length;
}

// ---------- Refactoring moves ----------

export type Move =
  | { type: "insertBranch"; offer: OfferId; position: number }
  | { type: "extractInterface" }
  | { type: "moveToClass"; offer: OfferId }
  | { type: "injectStrategies" }
  | { type: "addStrategyClass"; offer: OfferId }
  | { type: "editCheckout"; offer: OfferId };

export type MoveResult = { ok: true; design: Design } | { ok: false; reason: string };

export function applyMove(design: Design, move: Move): MoveResult {
  switch (move.type) {
    case "insertBranch": {
      if (design.injected) return { ok: false, reason: "Checkout no longer has an if-else chain to edit." };
      const chain = design.chain.filter((e) => e.offer !== move.offer);
      const at = Math.max(0, Math.min(move.position, chain.length));
      chain.splice(at, 0, { offer: move.offer, extracted: false });
      return { ok: true, design: { ...design, chain } };
    }
    case "extractInterface":
      if (design.interfaceExtracted) return { ok: false, reason: "PricingStrategy already exists." };
      return { ok: true, design: { ...design, interfaceExtracted: true } };
    case "moveToClass": {
      if (!design.interfaceExtracted) {
        return { ok: false, reason: "A class needs a shared interface to implement first. Extract PricingStrategy." };
      }
      const entry = design.chain.find((e) => e.offer === move.offer);
      if (!entry || entry.extracted) return { ok: false, reason: `${OFFERS[move.offer].label} is not an inline branch.` };
      return {
        ok: true,
        design: { ...design, chain: design.chain.map((e) => (e.offer === move.offer ? { ...e, extracted: true } : e)) },
      };
    }
    case "injectStrategies": {
      const inline = design.chain.filter((e) => !e.extracted);
      if (!design.interfaceExtracted || inline.length > 0) {
        return { ok: false, reason: "Move every branch into its own class before Checkout can take a list of strategies." };
      }
      return { ok: true, design: { ...design, injected: true, strategies: design.chain.map((e) => e.offer) } };
    }
    case "addStrategyClass":
      if (!design.injected) return { ok: false, reason: "Checkout cannot use new strategy classes yet." };
      if (offersIn(design).includes(move.offer)) return { ok: false, reason: `${OFFERS[move.offer].label} already exists.` };
      return { ok: true, design: { ...design, strategies: [...design.strategies, move.offer] } };
    case "editCheckout":
      if (!design.injected) return { ok: false, reason: "Use insertBranch for the legacy chain." };
      if (offersIn(design).includes(move.offer)) return { ok: false, reason: `${OFFERS[move.offer].label} already exists.` };
      // Works at runtime, but it modifies a class that was already finished and tested.
      return { ok: true, design: { ...design, inlineAdditions: [...design.inlineAdditions, move.offer] } };
  }
}

// ---------- Behaviour harness ----------

export interface ScenarioResult {
  id: string;
  needs: OfferId;
  label: string;
  expected: number;
  actual: number;
  pass: boolean;
}

export interface HarnessReport {
  results: ScenarioResult[];
  passed: number;
  total: number;
  /** Requested offers the design does not implement at all. */
  missing: OfferId[];
  /** Existing classes edited to add behaviour; must be empty for the Open/Closed check. */
  openClosedViolations: string[];
}

/** Runs the client's acceptance scenarios for every requested offer against the player's design. */
export function runHarness(design: Design, requested: OfferId[]): HarnessReport {
  const price = compile(design);
  const results = SCENARIOS.filter((s) => requested.includes(s.needs)).map((s) => {
    const expected = specTotal(s.order, requested);
    const actual = price(s.order);
    return { id: s.id, needs: s.needs, label: s.label, expected, actual, pass: expected === actual };
  });
  const implemented = offersIn(design);
  return {
    results,
    passed: results.filter((r) => r.pass).length,
    total: results.length,
    missing: requested.filter((id) => !implemented.includes(id)),
    openClosedViolations: design.inlineAdditions.length > 0 ? ["Checkout"] : [],
  };
}
