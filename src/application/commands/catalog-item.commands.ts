import type { DatabasePort } from "@/application/ports/database";
import { toAppError, type AppError } from "@/application/errors";
import { getCatalogItem } from "@/application/queries/list-catalog-items.query";
import type { CatalogItem, CatalogItemInput } from "@/domain/catalog/types";
import { err, ok, type Result } from "@/lib/result";

export async function createCatalogItem(
  db: DatabasePort,
  input: CatalogItemInput,
): Promise<Result<CatalogItem, AppError>> {
  try {
    const now = new Date().toISOString();
    const result = await db.execute(
      `INSERT INTO catalog_items
         (name, description, unit, unit_price_yen, cost_price_yen, tax_category, min_quantity, is_active,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.description,
        input.unit,
        input.unitPriceYen,
        input.costPriceYen,
        input.taxCategory,
        input.minQuantity,
        input.isActive ? 1 : 0,
        now,
        now,
      ],
    );
    const created = await getCatalogItem(db, result.lastInsertId);
    if (!created) {
      return err({ code: "save_failed", message: "商品の登録に失敗しました" });
    }
    return ok(created);
  } catch (error) {
    return err(toAppError(error, "商品の登録に失敗しました"));
  }
}

export async function updateCatalogItem(
  db: DatabasePort,
  id: number,
  input: CatalogItemInput,
): Promise<Result<CatalogItem, AppError>> {
  try {
    const now = new Date().toISOString();
    await db.execute(
      `UPDATE catalog_items SET name = ?, description = ?, unit = ?, unit_price_yen = ?,
         cost_price_yen = ?, tax_category = ?, min_quantity = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.name,
        input.description,
        input.unit,
        input.unitPriceYen,
        input.costPriceYen,
        input.taxCategory,
        input.minQuantity,
        input.isActive ? 1 : 0,
        now,
        id,
      ],
    );
    const updated = await getCatalogItem(db, id);
    if (!updated) {
      return err({ code: "not_found", message: "対象の商品が見つかりません" });
    }
    return ok(updated);
  } catch (error) {
    return err(toAppError(error, "商品の更新に失敗しました"));
  }
}

export async function deleteCatalogItem(
  db: DatabasePort,
  id: number,
): Promise<Result<void, AppError>> {
  try {
    await db.execute(`DELETE FROM catalog_items WHERE id = ?`, [id]);
    return ok(undefined);
  } catch (error) {
    return err(
      toAppError(
        error,
        "この商品は書類から参照されている可能性があります。非表示(無効化)をお試しください。",
      ),
    );
  }
}
