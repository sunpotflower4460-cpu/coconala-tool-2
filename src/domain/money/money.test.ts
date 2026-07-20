import { describe, expect, it } from "vitest";
import { assertYen, clampToZeroYen, sumYen } from "@/domain/money";

describe("assertYen", () => {
  it("accepts integers", () => {
    expect(assertYen(19800, "単価")).toBe(19800);
    expect(assertYen(0, "単価")).toBe(0);
  });

  it("rejects decimals", () => {
    expect(() => assertYen(19800.5, "単価")).toThrow(/円の整数/);
  });

  it("rejects non-finite values", () => {
    expect(() => assertYen(Number.NaN, "単価")).toThrow();
    expect(() => assertYen(Number.POSITIVE_INFINITY, "単価")).toThrow();
  });
});

describe("sumYen", () => {
  it("sums integer yen values", () => {
    expect(sumYen([100, 200, 300])).toBe(600);
    expect(sumYen([])).toBe(0);
  });
});

describe("clampToZeroYen", () => {
  it("clamps negative values to zero", () => {
    expect(clampToZeroYen(-100)).toBe(0);
    expect(clampToZeroYen(100)).toBe(100);
    expect(clampToZeroYen(0)).toBe(0);
  });
});
