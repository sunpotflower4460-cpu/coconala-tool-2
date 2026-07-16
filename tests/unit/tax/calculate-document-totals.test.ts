import { describe, expect, it } from "vitest";
import { calculateDocumentTotals } from "@/domain/tax";
import type { DocumentLineInput } from "@/domain/tax/types";

const exclusive = (roundingMode: "floor" | "round" | "ceil" = "floor") => ({
  pricingType: "tax_exclusive" as const,
  roundingMode,
});

describe("calculateDocumentTotals", () => {
  it("税抜10%、値引きなしの単一明細", () => {
    const lines: DocumentLineInput[] = [
      { quantity: 1, unitPriceYen: 1000, taxCategory: "taxable_10" },
    ];
    const result = calculateDocumentTotals(lines, exclusive());
    expect(result.subtotalYen).toBe(1000);
    expect(result.taxYen).toBe(100);
    expect(result.totalYen).toBe(1100);
  });

  it("税込10%は内税として税額を逆算する", () => {
    const lines: DocumentLineInput[] = [
      { quantity: 1, unitPriceYen: 1100, taxCategory: "taxable_10" },
    ];
    const result = calculateDocumentTotals(lines, {
      pricingType: "tax_inclusive",
      roundingMode: "floor",
    });
    expect(result.subtotalYen).toBe(1100);
    expect(result.taxYen).toBe(100);
    expect(result.totalYen).toBe(1100);
  });

  it("非課税は税額0になる", () => {
    const lines: DocumentLineInput[] = [
      { quantity: 1, unitPriceYen: 1000, taxCategory: "tax_exempt" },
    ];
    const result = calculateDocumentTotals(lines, exclusive());
    expect(result.taxYen).toBe(0);
    expect(result.totalYen).toBe(1000);
  });

  it("0円の明細を扱える", () => {
    const lines: DocumentLineInput[] = [
      { quantity: 1, unitPriceYen: 0, taxCategory: "taxable_10" },
    ];
    const result = calculateDocumentTotals(lines, exclusive());
    expect(result.subtotalYen).toBe(0);
    expect(result.taxYen).toBe(0);
    expect(result.totalYen).toBe(0);
  });

  it("1円の明細で端数処理方式ごとに税額が変わる", () => {
    const lines: DocumentLineInput[] = [
      { quantity: 1, unitPriceYen: 1, taxCategory: "taxable_10" },
    ];
    expect(calculateDocumentTotals(lines, exclusive("floor")).taxYen).toBe(0);
    expect(calculateDocumentTotals(lines, exclusive("round")).taxYen).toBe(0);
    expect(calculateDocumentTotals(lines, exclusive("ceil")).taxYen).toBe(1);
  });

  it("大きな金額でも整数のまま計算できる", () => {
    const lines: DocumentLineInput[] = [
      { quantity: 3, unitPriceYen: 12_345_678, taxCategory: "taxable_10" },
    ];
    const result = calculateDocumentTotals(lines, exclusive());
    expect(result.subtotalYen).toBe(37_037_034);
    expect(result.taxYen).toBe(3_703_703);
    expect(result.totalYen).toBe(40_740_737);
  });

  it("明細値引きを適用する", () => {
    const lines: DocumentLineInput[] = [
      { quantity: 2, unitPriceYen: 1000, taxCategory: "taxable_10", lineDiscountYen: 200 },
    ];
    const result = calculateDocumentTotals(lines, exclusive());
    expect(result.lines[0]?.amountYen).toBe(1800);
    expect(result.subtotalYen).toBe(1800);
    expect(result.taxYen).toBe(180);
    expect(result.totalYen).toBe(1980);
  });

  it("複数税率が混在する明細を税区分ごとに集計する", () => {
    const lines: DocumentLineInput[] = [
      { quantity: 1, unitPriceYen: 1000, taxCategory: "taxable_10" },
      { quantity: 1, unitPriceYen: 1000, taxCategory: "taxable_8" },
      { quantity: 1, unitPriceYen: 1000, taxCategory: "tax_exempt" },
    ];
    const result = calculateDocumentTotals(lines, exclusive());
    expect(result.subtotalYen).toBe(3000);
    expect(result.taxYen).toBe(180); // 100 + 80 + 0
    expect(result.totalYen).toBe(3180);
    expect(result.taxBreakdown).toHaveLength(3);
  });

  it("全体値引きを明細金額の比率で按分する", () => {
    const lines: DocumentLineInput[] = [
      { quantity: 1, unitPriceYen: 1000, taxCategory: "taxable_10" },
      { quantity: 1, unitPriceYen: 1000, taxCategory: "taxable_8" },
    ];
    const result = calculateDocumentTotals(lines, { ...exclusive(), discountYen: 100 });
    expect(result.lines[0]?.amountYen).toBe(950);
    expect(result.lines[1]?.amountYen).toBe(950);
    expect(result.subtotalYen).toBe(1900);
    expect(result.taxYen).toBe(171); // floor(950*0.1)=95, floor(950*0.08)=76
    expect(result.totalYen).toBe(2071);
  });

  it("端数処理方式(floor/round/ceil)を税額計算へ反映する", () => {
    const lines: DocumentLineInput[] = [
      { quantity: 1, unitPriceYen: 3330, taxCategory: "taxable_10" },
    ];
    expect(calculateDocumentTotals(lines, exclusive("floor")).taxYen).toBe(333);
    expect(calculateDocumentTotals(lines, exclusive("round")).taxYen).toBe(333);
    const lines2: DocumentLineInput[] = [
      { quantity: 1, unitPriceYen: 3335, taxCategory: "taxable_10" },
    ];
    expect(calculateDocumentTotals(lines2, exclusive("round")).taxYen).toBe(334); // 333.5 -> round to 334
    expect(calculateDocumentTotals(lines2, exclusive("ceil")).taxYen).toBe(334);
  });

  it("値引きが明細合計を超える場合はエラーになる", () => {
    const lines: DocumentLineInput[] = [
      { quantity: 1, unitPriceYen: 1000, taxCategory: "taxable_10" },
    ];
    expect(() => calculateDocumentTotals(lines, { ...exclusive(), discountYen: 2000 })).toThrow(
      /値引きが明細合計を超えています/,
    );
  });

  it("数量が不正な場合はエラーになる", () => {
    const lines: DocumentLineInput[] = [
      { quantity: -1, unitPriceYen: 1000, taxCategory: "taxable_10" },
    ];
    expect(() => calculateDocumentTotals(lines, exclusive())).toThrow(/数量/);
  });
});
