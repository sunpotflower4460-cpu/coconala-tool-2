import type { DatabasePort } from "@/application/ports/database";
import type { CatalogItem } from "@/domain/catalog/types";
import type { TaxCategory } from "@/domain/tax/types";

interface CatalogItemRow {
  id: number;
  name: string;
  description: string | null;
  unit: string | null;
  unit_price_yen: number;
  cost_price_yen: number | null;
  tax_category: TaxCategory;
  min_quantity: number | null;
  is_active: number;
}

export function mapCatalogItemRow(row: CatalogItemRow): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    unit: row.unit,
    unitPriceYen: row.unit_price_yen,
    costPriceYen: row.cost_price_yen,
    taxCategory: row.tax_category,
    minQuantity: row.min_quantity,
    isActive: row.is_active === 1,
  };
}

export interface ListCatalogItemsOptions {
  search?: string;
  activeOnly?: boolean;
}

export async function listCatalogItems(
  db: DatabasePort,
  options: ListCatalogItemsOptions = {},
): Promise<CatalogItem[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const search = options.search?.trim();
  if (search) {
    conditions.push("(name LIKE ? OR description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (options.activeOnly) {
    conditions.push("is_active = 1");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await db.select<CatalogItemRow>(
    `SELECT id, name, description, unit, unit_price_yen, cost_price_yen, tax_category, min_quantity, is_active
     FROM catalog_items ${where} ORDER BY name ASC`,
    params,
  );
  return rows.map(mapCatalogItemRow);
}

export async function getCatalogItem(db: DatabasePort, id: number): Promise<CatalogItem | null> {
  const rows = await db.select<CatalogItemRow>(
    `SELECT id, name, description, unit, unit_price_yen, cost_price_yen, tax_category, min_quantity, is_active
     FROM catalog_items WHERE id = ?`,
    [id],
  );
  return rows[0] ? mapCatalogItemRow(rows[0]) : null;
}
