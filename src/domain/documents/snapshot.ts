import type { DocumentTotals, PricingType, RoundingMode, TaxGroupTotal } from "@/domain/tax/types";

export interface CalculationSnapshot {
  pricingType: PricingType;
  roundingMode: RoundingMode;
  discountYen: number;
  subtotalYen: number;
  taxYen: number;
  totalYen: number;
  taxBreakdown: TaxGroupTotal[];
}

export interface BuildCalculationSnapshotOptions {
  pricingType: PricingType;
  roundingMode: RoundingMode;
  discountYen: number;
}

export function buildCalculationSnapshot(
  totals: DocumentTotals,
  options: BuildCalculationSnapshotOptions,
): CalculationSnapshot {
  return {
    pricingType: options.pricingType,
    roundingMode: options.roundingMode,
    discountYen: options.discountYen,
    subtotalYen: totals.subtotalYen,
    taxYen: totals.taxYen,
    totalYen: totals.totalYen,
    taxBreakdown: totals.taxBreakdown,
  };
}
