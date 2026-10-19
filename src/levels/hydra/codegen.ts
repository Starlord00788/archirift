import { OFFERS, type OfferId } from "./domain";
import type { Design } from "./design";

export type Language = "ts" | "java";

/**
 * Generates the source code the player's design corresponds to, for the Code lens.
 * The TypeScript output is compiled and run against the same scenarios in tests, and the Java output
 * is compiled and run in CI, so the Code lens can never show code that does not work.
 */
export function generateCode(design: Design, language: Language): string {
  return language === "ts" ? typescript(design) : java(design);
}

const indent = (text: string, spaces: number) =>
  text
    .split("\n")
    .map((line) => (line ? " ".repeat(spaces) + line : line))
    .join("\n");

// ---------------- TypeScript ----------------

function typescript(design: Design): string {
  const parts: string[] = [];
  if (design.interfaceExtracted) {
    parts.push(
      [
        "interface PricingStrategy {",
        "  appliesTo(order: Order): boolean;",
        "  discount(order: Order): number;",
        "}",
      ].join("\n"),
    );
    for (const id of classOffers(design)) {
      const o = OFFERS[id];
      parts.push(
        [
          `class ${o.className} implements PricingStrategy {`,
          `  appliesTo(order: Order): boolean { return ${o.code.ts.cond}; }`,
          `  discount(order: Order): number { return ${o.code.ts.discount}; }`,
          "}",
        ].join("\n"),
      );
    }
  }
  parts.push(design.injected ? tsInjectedCheckout(design) : tsChainCheckout(design));
  return parts.join("\n\n");
}

function tsChainCheckout(design: Design): string {
  const fields = design.chain
    .filter((e) => e.extracted)
    .map((e) => `  private readonly ${field(e.offer)} = new ${OFFERS[e.offer].className}();`);
  const branches = design.chain.map((e, i) => {
    const o = OFFERS[e.offer];
    const keyword = i === 0 ? "if" : "} else if";
    const [cond, discount] = e.extracted
      ? [`this.${field(e.offer)}.appliesTo(order)`, `this.${field(e.offer)}.discount(order)`]
      : [o.code.ts.cond, o.code.ts.discount];
    return `${keyword} (${cond}) {\n  return Math.max(0, total - ${discount});`;
  });
  const body = [
    "const total = subtotal(order);",
    ...(branches.length ? [branches.join("\n"), "}"] : []),
    "return total;",
  ].join("\n");
  return [
    "class Checkout {",
    ...fields,
    ...(fields.length ? [""] : []),
    "  total(order: Order): number {",
    indent(body, 4),
    "  }",
    "}",
  ].join("\n");
}

function tsInjectedCheckout(design: Design): string {
  const extra = design.inlineAdditions;
  const lines = [
    "class Checkout {",
    "  constructor(private readonly strategies: PricingStrategy[]) {}",
    "",
    "  total(order: Order): number {",
    "    const total = subtotal(order);",
    "    const discounts = this.strategies",
    "      .filter((s) => s.appliesTo(order))",
    "      .map((s) => s.discount(order));",
  ];
  for (const id of extra) {
    const o = OFFERS[id];
    lines.push(`    // Edited after release: ${o.label} added inside Checkout`);
    lines.push(`    if (${o.code.ts.cond}) discounts.push(${o.code.ts.discount});`);
  }
  lines.push("    return Math.max(0, total - Math.max(0, ...discounts));", "  }", "}");
  const strategies = classOffers(design).map((id) => `new ${OFFERS[id].className}()`);
  return [...lines, "", `const checkout = new Checkout([${strategies.join(", ")}]);`].join("\n");
}

// ---------------- Java ----------------

function java(design: Design): string {
  const parts: string[] = [];
  if (design.interfaceExtracted) {
    parts.push(
      ["interface PricingStrategy {", "    boolean appliesTo(Order order);", "    long discount(Order order);", "}"].join("\n"),
    );
    for (const id of classOffers(design)) {
      const o = OFFERS[id];
      parts.push(
        [
          `class ${o.className} implements PricingStrategy {`,
          `    public boolean appliesTo(Order order) { return ${o.code.java.cond}; }`,
          `    public long discount(Order order) { return ${o.code.java.discount}; }`,
          "}",
        ].join("\n"),
      );
    }
  }
  parts.push(design.injected ? javaInjectedCheckout(design) : javaChainCheckout(design));
  return parts.join("\n\n");
}

function javaChainCheckout(design: Design): string {
  const fields = design.chain
    .filter((e) => e.extracted)
    .map((e) => `    private final PricingStrategy ${field(e.offer)} = new ${OFFERS[e.offer].className}();`);
  const branches = design.chain.map((e, i) => {
    const o = OFFERS[e.offer];
    const keyword = i === 0 ? "if" : "} else if";
    const [cond, discount] = e.extracted
      ? [`${field(e.offer)}.appliesTo(order)`, `${field(e.offer)}.discount(order)`]
      : [o.code.java.cond, o.code.java.discount];
    return `${keyword} (${cond}) {\n    return Math.max(0, total - ${discount});`;
  });
  const body = [
    "long total = order.subtotal();",
    ...(branches.length ? [branches.join("\n"), "}"] : []),
    "return total;",
  ].join("\n");
  return [
    "class Checkout {",
    ...fields,
    ...(fields.length ? [""] : []),
    "    public long total(Order order) {",
    indent(body, 8),
    "    }",
    "}",
  ].join("\n");
}

function javaInjectedCheckout(design: Design): string {
  const extra = design.inlineAdditions;
  const lines = [
    "class Checkout {",
    "    private final List<PricingStrategy> strategies;",
    "",
    "    Checkout(List<PricingStrategy> strategies) {",
    "        this.strategies = strategies;",
    "    }",
    "",
    "    public long total(Order order) {",
    "        long total = order.subtotal();",
    "        long best = 0;",
    "        for (PricingStrategy s : strategies) {",
    "            if (s.appliesTo(order)) best = Math.max(best, s.discount(order));",
    "        }",
  ];
  for (const id of extra) {
    const o = OFFERS[id];
    lines.push(`        // Edited after release: ${o.label} added inside Checkout`);
    lines.push(`        if (${o.code.java.cond}) best = Math.max(best, ${o.code.java.discount});`);
  }
  lines.push("        return Math.max(0, total - best);", "    }", "}");
  return lines.join("\n");
}

// ---------------- helpers ----------------

function field(id: OfferId): string {
  const name = OFFERS[id].className;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/** Offers that exist as PricingStrategy classes in this design. */
export function classOffers(design: Design): OfferId[] {
  if (!design.injected) return design.chain.filter((e) => e.extracted).map((e) => e.offer);
  return design.strategies;
}
