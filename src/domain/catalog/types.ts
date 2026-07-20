import type { TaxCategory } from "@/domain/tax/types";

export interface CatalogItem {
  id: number;
  name: string;
  description: string | null;
  unit: string | null;
  unitPriceYen: number;
  costPriceYen: number | null;
  taxCategory: TaxCategory;
  minQuantity: number | null;
  isActive: boolean;
}

export interface CatalogItemInput {
  name: string;
  description: string | null;
  unit: string | null;
  unitPriceYen: number;
  costPriceYen: number | null;
  taxCategory: TaxCategory;
  minQuantity: number | null;
  isActive: boolean;
}
