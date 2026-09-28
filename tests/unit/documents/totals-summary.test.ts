import { describe, expect, it } from "vitest";
import {
  buildTotalsSummaryRows,
  isTotalsSummaryConsistent,
} from "@/domain/documents/totals-summary";
import { calculateDocumentTotals } from "@/domain/tax/calculate-document-totals";
import type { DocumentLineInput, PricingType } from "@/domain/tax/types";

function summarize(lines: DocumentLineInput[], discountYen: number, pricingType: PricingType) {
  const totals = calculateDocumentTotals(lines, {
    discountYen,
    pricingType,
    roundingMode: "floor",
  });
  return {
    totals,
    rows: buildTotalsSummaryRows({
      pricingType,
      subtotalYen: totals.subtotalYen,
      totalYen: totals.totalYen,
      discountYen,
      taxBreakdown: totals.taxBreakdown,
    }),
  };
}

describe("帳票の合計欄(buildTotalsSummaryRows)", () => {
  it("値引きありの税抜き: 明細合計→値引き→小計→対象額→消費税→合計の順で、計算が合う", () => {
    const { rows } = summarize(
      [{ quantity: 1, unitPriceYen: 100_000, taxCategory: "taxable_10" }],
      10_000,
      "tax_exclusive",
    );
    expect(rows.map((row) => [row.label, row.amountYen])).toEqual([
      ["明細合計", 100_000],
      ["値引き", -10_000],
      ["小計(値引き後)", 90_000],
      ["10%対象(税抜)", 90_000],
      ["消費税(10%)", 9_000],
      ["合計(税込)", 99_000],
    ]);
    expect(isTotalsSummaryConsistent(rows)).toBe(true);
  });

  it("税込み: 消費税は「うち消費税」として表示し、合計へ足さない", () => {
    const { rows, totals } = summarize(
      [{ quantity: 1, unitPriceYen: 11_000, taxCategory: "taxable_10" }],
      0,
      "tax_inclusive",
    );
    expect(rows.map((row) => row.label)).toEqual([
      "小計",
      "10%対象(税込)",
      "うち消費税(10%)",
      "合計(税込)",
    ]);
    expect(rows.find((row) => row.kind === "included_tax")?.amountYen).toBe(1_000);
    expect(totals.totalYen).toBe(11_000);
    expect(isTotalsSummaryConsistent(rows)).toBe(true);
  });

  it("複数税率と値引き: 税率ごとの対象額は値引き按分後で、合計と矛盾しない", () => {
    const { rows, totals } = summarize(
      [
        { quantity: 2, unitPriceYen: 10_000, taxCategory: "taxable_10" },
        { quantity: 1, unitPriceYen: 5_000, taxCategory: "taxable_8" },
        { quantity: 1, unitPriceYen: 3_000, taxCategory: "tax_exempt" },
      ],
      2_800,
      "tax_exclusive",
    );
    const bases = rows.filter((row) => row.kind === "taxable_base");
    expect(bases.reduce((sum, row) => sum + row.amountYen, 0)).toBe(totals.subtotalYen);
    expect(rows.find((row) => row.label === "8%※対象(税抜)")).toBeDefined();
    expect(rows.find((row) => row.label === "非課税対象")).toBeDefined();
    expect(isTotalsSummaryConsistent(rows)).toBe(true);
  });

  it("値引き0のときは値引き行を出さない", () => {
    const { rows } = summarize(
      [{ quantity: 1, unitPriceYen: 1_000, taxCategory: "taxable_10" }],
      0,
      "tax_exclusive",
    );
    expect(rows.some((row) => row.kind === "discount" || row.kind === "gross")).toBe(false);
  });

  it("矛盾した値を渡すと検査で検出できる", () => {
    const rows = buildTotalsSummaryRows({
      pricingType: "tax_exclusive",
      subtotalYen: 90_000,
      totalYen: 89_000,
      discountYen: 10_000,
      taxBreakdown: [{ taxCategory: "taxable_10", taxableAmountYen: 90_000, taxYen: 9_000 }],
    });
    expect(isTotalsSummaryConsistent(rows)).toBe(false);
  });
});
