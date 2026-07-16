import { describe, expect, it } from "vitest";
import { allocateProportionally } from "@/domain/tax/allocate";

describe("allocateProportionally", () => {
  it("splits evenly when weights are equal", () => {
    expect(allocateProportionally(300, [100, 100, 100])).toEqual([100, 100, 100]);
  });

  it("distributes remainders to the largest fractional shares", () => {
    // 100を3等分 -> 33.33... 端数1円は最大剰余の項目へ
    const result = allocateProportionally(100, [1, 1, 1]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    expect(result.sort()).toEqual([33, 33, 34]);
  });

  it("returns all zero when total is zero", () => {
    expect(allocateProportionally(0, [10, 20, 30])).toEqual([0, 0, 0]);
  });

  it("returns all zero when weights sum to zero", () => {
    expect(allocateProportionally(100, [0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("always sums exactly to the total for skewed weights", () => {
    const result = allocateProportionally(1001, [7, 293, 41, 1]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(1001);
  });
});
