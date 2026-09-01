import { DomainError } from "@/domain/shared/errors";
import { allocateProportionally } from "@/domain/tax/allocate";
import { roundYen } from "@/domain/tax/rounding";
import {
  TAX_RATES,
  type CalculateDocumentTotalsOptions,
  type DocumentLineInput,
  type DocumentTotals,
  type TaxCategory,
  type TaxGroupTotal,
} from "@/domain/tax/types";

const TAX_CATEGORIES: TaxCategory[] = ["taxable_10", "taxable_8", "tax_exempt"];

export function calculateDocumentTotals(
  lines: DocumentLineInput[],
  options: CalculateDocumentTotalsOptions,
): DocumentTotals {
  const discountYen = options.discountYen ?? 0;

  const rawAmounts = lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 0) {
      throw new DomainError(
        `数量は0以上の整数である必要があります: ${line.quantity}`,
        "invalid_quantity",
      );
    }
    if (!Number.isInteger(line.unitPriceYen) || line.unitPriceYen < 0) {
      throw new DomainError(
        `単価は0以上の円の整数である必要があります: ${line.unitPriceYen}`,
        "invalid_unit_price",
      );
    }
    const lineDiscountYen = line.lineDiscountYen ?? 0;
    return Math.max(0, line.unitPriceYen * line.quantity - lineDiscountYen);
  });

  const rawSubtotal = rawAmounts.reduce((sum, amount) => sum + amount, 0);

  if (discountYen < 0) {
    throw new DomainError("全体値引きは0以上である必要があります", "invalid_discount");
  }
  if (discountYen > rawSubtotal) {
    throw new DomainError("全体値引きが明細合計を超えています", "discount_exceeds_subtotal");
  }

  const allocatedDiscounts = allocateProportionally(discountYen, rawAmounts);
  const netAmounts = rawAmounts.map((amount, index) => amount - (allocatedDiscounts[index] ?? 0));
  const subtotalYen = netAmounts.reduce((sum, amount) => sum + amount, 0);

  const taxBreakdown: TaxGroupTotal[] = TAX_CATEGORIES.map((taxCategory) => {
    const taxableAmountYen = lines.reduce(
      (sum, line, index) =>
        line.taxCategory === taxCategory ? sum + (netAmounts[index] ?? 0) : sum,
      0,
    );

    if (taxCategory === "tax_exempt" || taxableAmountYen === 0) {
      return { taxCategory, taxableAmountYen, taxYen: 0 };
    }

    const rate = TAX_RATES[taxCategory];
    const taxYen =
      options.pricingType === "tax_exclusive"
        ? roundYen(taxableAmountYen * rate, options.roundingMode)
        : roundYen((taxableAmountYen * rate) / (1 + rate), options.roundingMode);

    return { taxCategory, taxableAmountYen, taxYen };
  }).filter((group) => group.taxableAmountYen > 0);

  const taxYen = taxBreakdown.reduce((sum, group) => sum + group.taxYen, 0);
  const totalYen = options.pricingType === "tax_exclusive" ? subtotalYen + taxYen : subtotalYen;

  return {
    lines: rawAmounts.map((rawAmountYen, index) => ({
      rawAmountYen,
      amountYen: netAmounts[index] ?? 0,
    })),
    subtotalYen,
    taxYen,
    totalYen,
    taxBreakdown,
  };
}
