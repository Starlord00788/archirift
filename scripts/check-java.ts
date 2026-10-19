/**
 * Compiles and runs the Java shown in the Hydra's Code lens, and checks every scenario against the
 * specification (Milestone 1 exit checklist: "Honest"). Requires a JDK (javac and java on PATH).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LEGACY_OFFERS, MENU, OFFERS, SCENARIOS, specTotal, type OfferId, type Order } from "../src/levels/hydra/domain";
import { LEGACY_DESIGN, applyMove, type Design, type Move } from "../src/levels/hydra/design";
import { classOffers, generateCode } from "../src/levels/hydra/codegen";

const ORDER_CLASS = `
class Order {
    private final List<String> items; private final boolean student; private final int loyaltyYears;
    private final int hour; private final boolean festival; private final boolean rainy; private final boolean firstOrder;
    Order(List<String> items, boolean student, int loyaltyYears, int hour, boolean festival, boolean rainy, boolean firstOrder) {
        this.items = items; this.student = student; this.loyaltyYears = loyaltyYears; this.hour = hour;
        this.festival = festival; this.rainy = rainy; this.firstOrder = firstOrder;
    }
    boolean isStudent() { return student; }
    int getLoyaltyYears() { return loyaltyYears; }
    int getHour() { return hour; }
    boolean isFestival() { return festival; }
    boolean isRainy() { return rainy; }
    boolean isFirstOrder() { return firstOrder; }
    boolean has(String item) { return items.contains(item); }
    long subtotal() {
        long sum = 0;
        for (String item : items) sum += PRICES.get(item);
        return sum;
    }
    static final Map<String, Long> PRICES = Map.of(${Object.entries(MENU)
      .map(([id, item]) => `"${id}", ${item.price}L`)
      .join(", ")});
}`;

function javaOrder(o: Order): string {
  const items = o.items.map((i) => `"${i}"`).join(", ");
  return `new Order(List.of(${items}), ${Boolean(o.student)}, ${o.loyaltyYears ?? 0}, ${o.hour ?? 11}, ${Boolean(o.festival)}, ${Boolean(o.rainy)}, ${Boolean(o.firstOrder)})`;
}

function play(...moves: Move[]): Design {
  return moves.reduce((d, m) => {
    const r = applyMove(d, m);
    if (!r.ok) throw new Error(r.reason);
    return r.design;
  }, LEGACY_DESIGN);
}

const refactor: Move[] = [
  { type: "extractInterface" },
  { type: "moveToClass", offer: "student" },
  { type: "moveToClass", offer: "loyalty" },
  { type: "moveToClass", offer: "happyHour" },
  { type: "injectStrategies" },
];
const all: OfferId[] = [...LEGACY_OFFERS, "festival", "monsoon", "combo", "firstOrder"];
const cases: { name: string; design: Design; offers: OfferId[] }[] = [
  { name: "legacy chain", design: LEGACY_DESIGN, offers: [...LEGACY_OFFERS] },
  { name: "half refactored", design: play(refactor[0], refactor[1]), offers: [...LEGACY_OFFERS] },
  { name: "festival edited into Checkout", design: play(...refactor, { type: "editCheckout", offer: "festival" }), offers: [...LEGACY_OFFERS, "festival"] },
  { name: "all offers as strategies", design: play(...refactor, ...all.slice(3).map((offer) => ({ type: "addStrategyClass" as const, offer }))), offers: all },
];

let failures = 0;
for (const { name, design, offers } of cases) {
  const dir = mkdtempSync(path.join(tmpdir(), "archirift-java-"));
  try {
    const scenarios = SCENARIOS.filter((s) => offers.includes(s.needs));
    const checkout = design.injected
      ? `new Checkout(List.of(${classOffers(design).map((id) => `new ${OFFERS[id].className}()`).join(", ")}))`
      : "new Checkout()";
    const main = [
      "import java.util.*;",
      ORDER_CLASS,
      generateCode(design, "java"),
      "public class Main {",
      "    public static void main(String[] args) {",
      `        Checkout checkout = ${checkout};`,
      ...scenarios.map((s) => `        System.out.println("${s.id}=" + checkout.total(${javaOrder(s.order)}));`),
      "    }",
      "}",
    ].join("\n");
    writeFileSync(path.join(dir, "Main.java"), main);
    execFileSync("javac", ["Main.java"], { cwd: dir, stdio: "pipe" });
    const output = execFileSync("java", ["-cp", dir, "Main"], { encoding: "utf8" });
    const actual = Object.fromEntries(output.trim().split(/\r?\n/).map((line) => line.split("=")));
    for (const s of scenarios) {
      const expected = specTotal(s.order, offers);
      if (Number(actual[s.id]) !== expected) {
        failures += 1;
        console.error(`✗ ${name} / ${s.id}: expected ${expected}, Java gave ${actual[s.id]}`);
      }
    }
    console.log(`✓ ${name}: ${scenarios.length} scenarios`);
  } catch (error) {
    failures += 1;
    const detail = error as { stderr?: Buffer; message: string };
    console.error(`✗ ${name}: ${detail.stderr?.toString() || detail.message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

process.exit(failures > 0 ? 1 : 0);
