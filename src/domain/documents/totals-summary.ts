import type { PricingType, TaxCategory, TaxGroupTotal } from "@/domain/tax/types";

/**
 * 帳票の合計欄に並べる行。計算はしない(発行時スナップショットの値をそのまま並べる)。
 * 上から順に読んだとき、足し引きが合計と一致する並びにすることが目的。
 *
 * - 値引きあり: 明細合計(値引き前) → 値引き → 小計(値引き後)
 * - 税抜き: 税率ごとの対象額(参考) と 消費税 → 合計 = 小計 + 消費税
 * - 税込み: 税率ごとの対象額(参考) と 「うち消費税」 → 合計 = 小計
 */
export type TotalsSummaryRowKind =
  | "gross" // 値引き前の明細合計
  | "discount" // 値引き(マイナス)
  | "subtotal"
  | "taxable_base" // 税率ごとの対象額(参考表示。合計の計算には使わない)
  | "tax" // 税抜きのときの消費税(合計へ加算される)
  | "included_tax" // 税込みのときの「うち消費税」(合計へ加算しない)
  | "total";

export interface TotalsSummaryRow {
  kind: TotalsSummaryRowKind;
  label: string;
  amountYen: number;
  taxCategory?: TaxCategory;
}

export interface TotalsSummaryInput {
  pricingType: PricingType;
  /** 全体値引き按分後の小計(calculateDocumentTotals の subtotalYen) */
  subtotalYen: number;
  totalYen: number;
  discountYen: number;
  taxBreakdown: TaxGroupTotal[];
}

/** 帳票に印字する税率の短い表記。軽減税率には「※」を付け、凡例と対応させる。 */
export const PRINT_TAX_RATE_LABELS: Record<TaxCategory, string> = {
  taxable_10: "10%",
  taxable_8: "8%※",
  tax_exempt: "非課税",
};

export const REDUCED_TAX_RATE_LEGEND = "※は軽減税率(8%)対象";

export function buildTotalsSummaryRows(input: TotalsSummaryInput): TotalsSummaryRow[] {
  const rows: TotalsSummaryRow[] = [];
  const taxSuffix = input.pricingType === "tax_exclusive" ? "(税抜)" : "(税込)";

  if (input.discountYen > 0) {
    rows.push({
      kind: "gross",
      label: "明細合計",
      amountYen: input.subtotalYen + input.discountYen,
    });
    rows.push({ kind: "discount", label: "値引き", amountYen: -input.discountYen });
    rows.push({ kind: "subtotal", label: "小計(値引き後)", amountYen: input.subtotalYen });
  } else {
    rows.push({ kind: "subtotal", label: "小計", amountYen: input.subtotalYen });
  }

  for (const group of input.taxBreakdown) {
    const rate = PRINT_TAX_RATE_LABELS[group.taxCategory];
    if (group.taxCategory === "tax_exempt") {
      rows.push({
        kind: "taxable_base",
        label: "非課税対象",
        amountYen: group.taxableAmountYen,
        taxCategory: group.taxCategory,
      });
      continue;
    }
    rows.push({
      kind: "taxable_base",
      label: `${rate}対象${taxSuffix}`,
      amountYen: group.taxableAmountYen,
      taxCategory: group.taxCategory,
    });
    rows.push(
      input.pricingType === "tax_exclusive"
        ? {
            kind: "tax",
            label: `消費税(${rate})`,
            amountYen: group.taxYen,
            taxCategory: group.taxCategory,
          }
        : {
            kind: "included_tax",
            label: `うち消費税(${rate})`,
            amountYen: group.taxYen,
            taxCategory: group.taxCategory,
          },
    );
  }

  // 税抜き・税込みのどちらでも、最終的な請求額は税込み。
  rows.push({ kind: "total", label: "合計(税込)", amountYen: input.totalYen });
  return rows;
}

/**
 * 表示された行を上から足し引きしたとき合計と一致するかを確かめる。
 * 対象額(参考)と「うち消費税」は合計の計算に含めない。
 */
export function isTotalsSummaryConsistent(rows: TotalsSummaryRow[]): boolean {
  const gross = rows.find((row) => row.kind === "gross");
  const discount = rows.find((row) => row.kind === "discount");
  const subtotal = rows.find((row) => row.kind === "subtotal");
  const total = rows.find((row) => row.kind === "total");
  if (!subtotal || !total) return false;
  if (gross && discount && gross.amountYen + discount.amountYen !== subtotal.amountYen) {
    return false;
  }
  const addedTax = rows
    .filter((row) => row.kind === "tax")
    .reduce((sum, row) => sum + row.amountYen, 0);
  return subtotal.amountYen + addedTax === total.amountYen;
}
