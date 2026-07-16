import type { CatalogItemInput } from "@/domain/catalog/types";
import type { TaxCategory } from "@/domain/tax/types";
import { readCell, type ColumnMapping, type CsvRowIssue } from "@/domain/csv/types";

const VALID_TAX_CATEGORIES: TaxCategory[] = ["taxable_10", "taxable_8", "tax_exempt"];

export function validateCatalogItemRows(
  dataRows: string[][],
  mapping: ColumnMapping,
): CsvRowIssue<CatalogItemInput>[] {
  return dataRows.map((raw, rowIndex) => {
    const errors: string[] = [];
    const name = readCell(raw, mapping, "name");
    if (!name) {
      errors.push("商品名が空です");
    }

    const priceText = readCell(raw, mapping, "unitPriceYen");
    let unitPriceYen: number | null = null;
    if (!priceText) {
      errors.push("単価が空です");
    } else {
      const parsed = Number(priceText);
      if (!Number.isInteger(parsed) || parsed < 0) {
        errors.push("単価は0以上の整数(円)で入力してください");
      } else {
        unitPriceYen = parsed;
      }
    }

    const taxCategoryText = readCell(raw, mapping, "taxCategory");
    let taxCategory: TaxCategory = "taxable_10";
    if (taxCategoryText) {
      if (!VALID_TAX_CATEGORIES.includes(taxCategoryText as TaxCategory)) {
        errors.push("税区分はtaxable_10 / taxable_8 / tax_exemptのいずれかで入力してください");
      } else {
        taxCategory = taxCategoryText as TaxCategory;
      }
    }

    if (errors.length > 0) {
      return { rowIndex, raw, data: null, errors };
    }

    return {
      rowIndex,
      raw,
      errors: [],
      data: {
        name: name!,
        description: null,
        unit: readCell(raw, mapping, "unit"),
        unitPriceYen: unitPriceYen!,
        costPriceYen: null,
        taxCategory,
        minQuantity: null,
        isActive: true,
      },
    };
  });
}
