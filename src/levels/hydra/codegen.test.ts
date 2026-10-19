import { describe, expect, it } from "vitest";
import ts from "typescript";
import { LEGACY_OFFERS, MENU, SCENARIOS, specTotal, type OfferId, type Order } from "./domain";
import { LEGACY_DESIGN, applyMove, type Design, type Move } from "./design";
import { generateCode } from "./codegen";

function play(...moves: Move[]): Design {
  return moves.reduce((d, m) => {
    const r = applyMove(d, m);
    if (!r.ok) throw new Error(r.reason);
    return r.design;
  }, LEGACY_DESIGN);
}

/** Compiles the generated TypeScript for real and returns its pricing function. */
function runGenerated(design: Design): (order: Order) => number {
  const source = [
    "type ItemId = keyof typeof MENU;",
    "interface Order { items: ItemId[]; student?: boolean; loyaltyYears?: number; hour?: number; festival?: boolean; rainy?: boolean; firstOrder?: boolean }",
    "const subtotal = (order: Order) => order.items.reduce((sum, item) => sum + MENU[item].price, 0);",
    generateCode(design, "ts"),
    design.injected ? "return (order: Order) => checkout.total(order);" : "return (order: Order) => new Checkout().total(order);",
  ].join("\n\n");
  const check = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    reportDiagnostics: true,
  });
  expect(check.diagnostics ?? []).toEqual([]);
  return new Function("MENU", check.outputText)(MENU);
}

const refactor: Move[] = [
  { type: "extractInterface" },
  { type: "moveToClass", offer: "student" },
  { type: "moveToClass", offer: "loyalty" },
  { type: "moveToClass", offer: "happyHour" },
  { type: "injectStrategies" },
];

const cases: { name: string; design: Design; offers: OfferId[] }[] = [
  { name: "legacy chain", design: LEGACY_DESIGN, offers: [...LEGACY_OFFERS] },
  { name: "half refactored", design: play(refactor[0], refactor[1]), offers: [...LEGACY_OFFERS] },
  { name: "strategy with festival class", design: play(...refactor, { type: "addStrategyClass", offer: "festival" }), offers: [...LEGACY_OFFERS, "festival"] },
  { name: "festival edited into Checkout", design: play(...refactor, { type: "editCheckout", offer: "festival" }), offers: [...LEGACY_OFFERS, "festival"] },
  {
    name: "all proof offers",
    design: play(...refactor, ...(["festival", "monsoon", "combo", "firstOrder"] as const).map((offer) => ({ type: "addStrategyClass" as const, offer }))),
    offers: [...LEGACY_OFFERS, "festival", "monsoon", "combo", "firstOrder"],
  },
];

describe("generated TypeScript", () => {
  it.each(cases)("$name compiles and prices every scenario like the spec", ({ design, offers }) => {
    const price = runGenerated(design);
    for (const scenario of SCENARIOS.filter((s) => offers.includes(s.needs))) {
      expect(price(scenario.order), scenario.id).toBe(specTotal(scenario.order, offers));
    }
  });

  it("shows the if-else chain before the refactor and an interface after it", () => {
    expect(generateCode(LEGACY_DESIGN, "ts")).toContain("} else if (order.loyaltyYears >= 2)");
    const after = generateCode(play(...refactor), "ts");
    expect(after).toContain("interface PricingStrategy");
    expect(after).not.toContain("else if");
  });
});

describe("generated Java", () => {
  it("mirrors the TypeScript structure", () => {
    const java = generateCode(play(...refactor, { type: "addStrategyClass", offer: "festival" }), "java");
    expect(java).toContain("class FestivalPricing implements PricingStrategy");
    expect(java).toContain("List<PricingStrategy> strategies");
  });
});
