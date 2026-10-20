import { describe, expect, it } from "vitest";
import { layoutDiagram } from "./diagramLayout";

const layerOf = (layout: ReturnType<typeof layoutDiagram>, id: string) => layout.nodes.find((n) => n.id === id)!.layer;

describe("layoutDiagram", () => {
  it("puts the client above the interface and implementers below it", () => {
    const layout = layoutDiagram(
      [{ id: "Checkout" }, { id: "PricingStrategy", kind: "interface" }, { id: "StudentPricing" }, { id: "LoyaltyPricing" }],
      [
        { from: "Checkout", to: "PricingStrategy", type: "uses" },
        { from: "StudentPricing", to: "PricingStrategy", type: "implements" },
        { from: "LoyaltyPricing", to: "PricingStrategy", type: "implements" },
      ],
    );
    expect(layerOf(layout, "Checkout")).toBe(0);
    expect(layerOf(layout, "PricingStrategy")).toBe(1);
    expect(layerOf(layout, "StudentPricing")).toBe(2);
    expect(layerOf(layout, "LoyaltyPricing")).toBe(2);
  });

  it("lays out an architecture top to bottom and survives a cycle", () => {
    const layout = layoutDiagram(
      [{ id: "Users", kind: "user" }, { id: "LB", kind: "lb" }, { id: "App", kind: "service" }, { id: "DB", kind: "database" }],
      [
        { from: "Users", to: "LB", type: "calls" },
        { from: "LB", to: "App", type: "routes" },
        { from: "App", to: "DB", type: "reads" },
        { from: "DB", to: "App", type: "replies" },
      ],
    );
    expect(["Users", "LB", "App", "DB"].map((id) => layerOf(layout, id))).toEqual([0, 1, 2, 3]);
    expect(layout.edges).toHaveLength(4);
    for (const n of layout.nodes) expect(n.x).toBeGreaterThanOrEqual(0);
  });

  it("ignores edges to unknown nodes", () => {
    const layout = layoutDiagram([{ id: "A" }], [{ from: "A", to: "Ghost", type: "uses" }]);
    expect(layout.edges).toEqual([]);
  });
});
