export type TaxCategory = "taxable_10" | "taxable_8" | "tax_exempt";
export type RoundingMode = "floor" | "round" | "ceil";
export type PricingType = "tax_exclusive" | "tax_inclusive";

export const TAX_RATES: Record<Exclude<TaxCategory, "tax_exempt">, number> = {
  taxable_10: 0.1,
  taxable_8: 0.08,
};

export interface DocumentLineInput {
  quantity: number;
  unitPriceYen: number;
  taxCategory: TaxCategory;
  lineDiscountYen?: number;
}

export interface DocumentLineTotal {
  /** 明細値引き適用後、全体値引き按分前の金額 */
  rawAmountYen: number;
  /** 全体値引き按分後の最終金額 */
  amountYen: number;
}

export interface TaxGroupTotal {
  taxCategory: TaxCategory;
  taxableAmountYen: number;
  taxYen: number;
}

export interface DocumentTotals {
  lines: DocumentLineTotal[];
  subtotalYen: number;
  taxYen: number;
  totalYen: number;
  taxBreakdown: TaxGroupTotal[];
}

export interface CalculateDocumentTotalsOptions {
  discountYen?: number;
  pricingType: PricingType;
  roundingMode: RoundingMode;
}
