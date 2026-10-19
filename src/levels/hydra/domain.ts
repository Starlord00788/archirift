/**
 * Brew & Bytes café: the pricing domain behind "The If-Else Hydra".
 * Everything here is real, executable logic so the level's tests genuinely pass or fail
 * (PRD: Simulation and validation model, "LLD validation").
 */

export const MENU = {
  latte: { name: "Latte", price: 180 },
  sandwich: { name: "Sandwich", price: 220 },
  cookie: { name: "Cookie", price: 60 },
  coldBrew: { name: "Cold brew", price: 200 },
} as const;

export type ItemId = keyof typeof MENU;

export interface Order {
  items: ItemId[];
  student?: boolean;
  loyaltyYears?: number;
  /** Hour of day, 0–23. */
  hour?: number;
  festival?: boolean;
  rainy?: boolean;
  firstOrder?: boolean;
}

export function subtotal(order: Order): number {
  return order.items.reduce((sum, item) => sum + MENU[item].price, 0);
}

export type OfferId = "student" | "loyalty" | "happyHour" | "festival" | "monsoon" | "combo" | "firstOrder";

export interface Offer {
  id: OfferId;
  label: string;
  className: string;
  /** One-line description shown to the player. */
  rule: string;
  applies(order: Order): boolean;
  discount(order: Order): number;
  /** Source fragments used by the Code lens (TypeScript and Java). */
  code: { ts: { cond: string; discount: string }; java: { cond: string; discount: string } };
}

const pct = (order: Order, percent: number) => Math.round((subtotal(order) * percent) / 100);

export const OFFERS: Record<OfferId, Offer> = {
  student: {
    id: "student",
    label: "Student",
    className: "StudentPricing",
    rule: "20% off for students",
    applies: (o) => Boolean(o.student),
    discount: (o) => pct(o, 20),
    code: {
      ts: { cond: "order.student", discount: "Math.round(subtotal(order) * 0.2)" },
      java: { cond: "order.isStudent()", discount: "Math.round(order.subtotal() * 0.2)" },
    },
  },
  loyalty: {
    id: "loyalty",
    label: "Loyalty",
    className: "LoyaltyPricing",
    rule: "₹30 off for customers of 2 years or more",
    applies: (o) => (o.loyaltyYears ?? 0) >= 2,
    discount: () => 30,
    code: {
      ts: { cond: "order.loyaltyYears >= 2", discount: "30" },
      java: { cond: "order.getLoyaltyYears() >= 2", discount: "30" },
    },
  },
  happyHour: {
    id: "happyHour",
    label: "Happy hour",
    className: "HappyHourPricing",
    rule: "15% off from 3 pm to 5 pm",
    applies: (o) => (o.hour ?? 11) >= 15 && (o.hour ?? 11) < 17,
    discount: (o) => pct(o, 15),
    code: {
      ts: { cond: "order.hour >= 15 && order.hour < 17", discount: "Math.round(subtotal(order) * 0.15)" },
      java: { cond: "order.getHour() >= 15 && order.getHour() < 17", discount: "Math.round(order.subtotal() * 0.15)" },
    },
  },
  festival: {
    id: "festival",
    label: "Festival",
    className: "FestivalPricing",
    rule: "₹80 off orders of ₹300 or more in festival week",
    applies: (o) => Boolean(o.festival) && subtotal(o) >= 300,
    discount: () => 80,
    code: {
      ts: { cond: "order.festival && subtotal(order) >= 300", discount: "80" },
      java: { cond: "order.isFestival() && order.subtotal() >= 300", discount: "80" },
    },
  },
  monsoon: {
    id: "monsoon",
    label: "Monsoon",
    className: "MonsoonPricing",
    rule: "10% off on rainy days",
    applies: (o) => Boolean(o.rainy),
    discount: (o) => pct(o, 10),
    code: {
      ts: { cond: "order.rainy", discount: "Math.round(subtotal(order) * 0.1)" },
      java: { cond: "order.isRainy()", discount: "Math.round(order.subtotal() * 0.1)" },
    },
  },
  combo: {
    id: "combo",
    label: "Office combo",
    className: "ComboPricing",
    rule: "₹50 off a latte with a sandwich",
    applies: (o) => o.items.includes("latte") && o.items.includes("sandwich"),
    discount: () => 50,
    code: {
      ts: { cond: 'order.items.includes("latte") && order.items.includes("sandwich")', discount: "50" },
      java: { cond: 'order.has("latte") && order.has("sandwich")', discount: "50" },
    },
  },
  firstOrder: {
    id: "firstOrder",
    label: "First order",
    className: "FirstOrderPricing",
    rule: "₹40 off a customer's first order",
    applies: (o) => Boolean(o.firstOrder),
    discount: () => 40,
    code: {
      ts: { cond: "order.firstOrder", discount: "40" },
      java: { cond: "order.isFirstOrder()", discount: "40" },
    },
  },
};

/** The legacy if-else order in Brew & Bytes' original code. */
export const LEGACY_OFFERS: OfferId[] = ["student", "loyalty", "happyHour"];
export const PROOF_OFFERS: OfferId[] = ["monsoon", "combo", "firstOrder"];

/**
 * The business rule the client actually wants: the single best offer applies, offers never stack,
 * and a bill never goes below zero. This is the specification every design is tested against.
 */
export function specTotal(order: Order, offers: OfferId[]): number {
  const best = Math.max(0, ...offers.map((id) => OFFERS[id]).filter((o) => o.applies(order)).map((o) => o.discount(order)));
  return Math.max(0, subtotal(order) - best);
}

export interface Scenario {
  id: string;
  /** Plain-language description shown on the test lights. */
  label: string;
  order: Order;
  /** The offer that must exist before this scenario is part of the client's tests. */
  needs: OfferId;
}

export const SCENARIOS: Scenario[] = [
  { id: "regular", label: "Regular customer buys a latte at 11 am", order: { items: ["latte"], hour: 11 }, needs: "student" },
  { id: "student", label: "Student buys a latte and a cookie", order: { items: ["latte", "cookie"], student: true }, needs: "student" },
  { id: "happy", label: "Sandwich at 4 pm, happy hour", order: { items: ["sandwich"], hour: 16 }, needs: "happyHour" },
  { id: "student-happy", label: "Student at happy hour: latte and sandwich", order: { items: ["latte", "sandwich"], student: true, hour: 16 }, needs: "happyHour" },
  { id: "loyal", label: "Loyal customer buys a cookie", order: { items: ["cookie"], loyaltyYears: 3 }, needs: "loyalty" },
  { id: "loyal-happy", label: "Loyal customer, cookie at happy hour", order: { items: ["cookie"], loyaltyYears: 3, hour: 16 }, needs: "loyalty" },
  { id: "festival", label: "Festival week: latte and sandwich", order: { items: ["latte", "sandwich"], festival: true }, needs: "festival" },
  { id: "festival-student-small", label: "Festival week, student spends ₹300", order: { items: ["latte", "cookie", "cookie"], student: true, festival: true }, needs: "festival" },
  { id: "festival-student-big", label: "Festival week, student spends ₹460", order: { items: ["latte", "sandwich", "cookie"], student: true, festival: true }, needs: "festival" },
  { id: "festival-loyal", label: "Festival week, loyal customer spends ₹400", order: { items: ["latte", "sandwich"], loyaltyYears: 3, festival: true }, needs: "festival" },
  { id: "monsoon", label: "Rainy day, regular latte", order: { items: ["latte"], rainy: true }, needs: "monsoon" },
  { id: "monsoon-student", label: "Rainy day, student latte", order: { items: ["latte"], rainy: true, student: true }, needs: "monsoon" },
  { id: "combo", label: "Office combo: latte and sandwich", order: { items: ["latte", "sandwich"] }, needs: "combo" },
  { id: "first", label: "First order: one cookie", order: { items: ["cookie"], firstOrder: true }, needs: "firstOrder" },
];
