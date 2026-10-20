import type { ViewEdge, ViewNode } from "@/components/GraphView";
import { OFFERS } from "../domain";
import type { Design } from "../design";
import { classOffers } from "../codegen";

/** The class diagram the player's current design corresponds to (the Blueprint lens). */
export function designToView(design: Design): { nodes: ViewNode[]; edges: ViewEdge[] } {
  const inline = design.injected ? [] : design.chain.filter((e) => !e.extracted);
  const checkoutLines = design.injected
    ? ["total(): best of strategies", ...design.inlineAdditions.map((id) => `+ edited in: ${OFFERS[id].label}`)]
    : design.chain.map((e, i) => `${i === 0 ? "if" : "else if"} ${e.extracted ? `${OFFERS[e.offer].className}` : OFFERS[e.offer].label.toLowerCase()}`);

  const nodes: ViewNode[] = [
    {
      id: "Checkout",
      kind: "client",
      lines: checkoutLines,
      tone: design.inlineAdditions.length > 0 ? "warn" : inline.length > 0 ? "bad" : "normal",
    },
  ];
  const edges: ViewEdge[] = [];
  if (design.interfaceExtracted) {
    nodes.push({ id: "PricingStrategy", kind: "interface", lines: ["appliesTo(order)", "discount(order)"] });
    const classes = classOffers(design);
    if (design.injected || classes.length > 0) edges.push({ from: "Checkout", to: "PricingStrategy", type: "uses" });
    for (const id of classes) {
      nodes.push({ id: OFFERS[id].className, kind: "class", lines: [OFFERS[id].rule] });
      edges.push({ from: OFFERS[id].className, to: "PricingStrategy", type: "implements" });
    }
  }
  return { nodes, edges };
}
