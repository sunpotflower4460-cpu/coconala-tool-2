import { describe, expect, it } from "vitest";
import { roundYen } from "@/domain/tax/rounding";

describe("roundYen", () => {
  it("floors", () => {
    expect(roundYen(10.9, "floor")).toBe(10);
    expect(roundYen(10.1, "floor")).toBe(10);
  });

  it("ceils", () => {
    expect(roundYen(10.1, "ceil")).toBe(11);
    expect(roundYen(10.0, "ceil")).toBe(10);
  });

  it("rounds to nearest", () => {
    expect(roundYen(10.5, "round")).toBe(11);
    expect(roundYen(10.4, "round")).toBe(10);
  });
});
