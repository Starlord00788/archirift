import { describe, expect, it } from "vitest";
import { diffGraphs, type Graph } from "./graphDiff";

const reference: Graph = {
  nodes: ["Checkout", "PricingStrategy", "StudentPricing", "FestivalPricing"],
  edges: [
    { from: "Checkout", to: "PricingStrategy", type: "uses" },
    { from: "StudentPricing", to: "PricingStrategy", type: "implements" },
    { from: "FestivalPricing", to: "PricingStrategy", type: "implements" },
  ],
};

describe("diffGraphs", () => {
  it("scores a perfect rebuild as 1 everywhere", () => {
    const diff = diffGraphs(reference, reference);
    expect(diff.scores).toEqual({ concepts: 1, relationships: 1, types: 1 });
    expect(diff.nodes.missing).toEqual([]);
  });

  it("separates forgotten concepts from wrong connections", () => {
    const diff = diffGraphs(reference, {
      nodes: ["Checkout", "PricingStrategy", "StudentPricing"],
      edges: [
        { from: "Checkout", to: "PricingStrategy", type: "uses" },
        { from: "StudentPricing", to: "PricingStrategy", type: "extends" },
      ],
    });
    expect(diff.nodes.missing).toEqual(["FestivalPricing"]);
    expect(diff.edges.wrongType).toHaveLength(1);
    expect(diff.edges.missing).toEqual([{ from: "FestivalPricing", to: "PricingStrategy", type: "implements" }]);
    expect(diff.scores.concepts).toBe(0.75);
    expect(diff.scores.relationships).toBeCloseTo(2 / 3);
    expect(diff.scores.types).toBe(0.5);
  });

  it("treats a reversed edge as missing plus an invalid extra", () => {
    const diff = diffGraphs(reference, {
      nodes: reference.nodes,
      edges: [{ from: "PricingStrategy", to: "Checkout", type: "uses" }],
    });
    expect(diff.edges.invalidExtra).toHaveLength(1);
    expect(diff.edges.missing).toHaveLength(3);
  });

  it("accepts aliases, ignores case and spacing, and recognises valid extras", () => {
    const diff = diffGraphs(
      reference,
      {
        nodes: ["checkout", "Discount Strategy", "student_pricing", "FestivalPricing", "MonsoonPricing"],
        edges: [
          { from: "checkout", to: "Discount Strategy", type: "Uses" },
          { from: "MonsoonPricing", to: "Discount Strategy", type: "implements" },
        ],
      },
      {
        aliases: { PricingStrategy: ["DiscountStrategy"] },
        acceptedExtras: { nodes: ["MonsoonPricing"], edges: [{ from: "MonsoonPricing", to: "PricingStrategy", type: "implements" }] },
      },
    );
    expect(diff.nodes.correct).toHaveLength(4);
    expect(diff.nodes.validExtra).toEqual(["MonsoonPricing"]);
    expect(diff.edges.correct).toHaveLength(1);
    expect(diff.edges.validExtra).toHaveLength(1);
  });
});
