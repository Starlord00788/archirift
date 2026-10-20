import { describe, expect, it } from "vitest";
import { tokenize } from "./highlight";

describe("tokenize", () => {
  it("highlights Java keywords, types, strings, comments and annotations", () => {
    const line = '@Override public String name() { return "hi \\"there\\""; } // done';
    const tokens = tokenize(line, "java");
    const kinds = (k: string) => tokens.filter((t) => t.kind === k).map((t) => t.text);
    expect(kinds("annotation")).toEqual(["@Override"]);
    expect(kinds("keyword")).toEqual(["public", "return"]);
    expect(kinds("type")).toEqual(["String"]);
    expect(kinds("string")).toEqual(['"hi \\"there\\""']);
    expect(kinds("comment")).toEqual(["// done"]);
    expect(tokens.map((t) => t.text).join("")).toBe(line);
  });

  it("does not treat i-- in Java as a comment, but does in SQL", () => {
    expect(tokenize("i--; x = 1", "java").some((t) => t.kind === "comment")).toBe(false);
    expect(tokenize("SELECT 1 -- note", "sql").at(-1)).toEqual({ kind: "comment", text: "-- note" });
  });

  it("does not split identifiers that contain digits", () => {
    expect(tokenize("int x2 = 42;", "java").filter((t) => t.kind === "number").map((t) => t.text)).toEqual(["42"]);
  });
});
