import type { DatabasePort } from "@/application/ports/database";
import { recordDocumentEvent } from "@/application/commands/document-events.helper";
import { toAppError, type AppError } from "@/application/errors";
import { getDocument, type DocumentDetail } from "@/application/queries/get-document.query";
import { err, ok, type Result } from "@/lib/result";

/** 状態を問わず、同じ種類の新しい下書きとして複製する(発行前提のconvertDocumentとは別)。 */
export async function duplicateDocument(
  db: DatabasePort,
  sourceId: number,
): Promise<Result<DocumentDetail, AppError>> {
  try {
    const source = await getDocument(db, sourceId);
    if (!source) {
      return err({ code: "not_found", message: "複製元の書類が見つかりません" });
    }

    const now = new Date().toISOString();
    await db.execute("BEGIN");
    const inserted = await db.execute(
      `INSERT INTO documents (
         document_type, status, client_id, pricing_type, rounding_mode, discount_yen,
         subtotal_yen, tax_yen, total_yen, note, created_at, updated_at
       ) VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        source.documentType,
        source.clientId,
        source.pricingType,
        source.roundingMode,
        source.discountYen,
        source.subtotalYen,
        source.taxYen,
        source.totalYen,
        source.note,
        now,
        now,
      ],
    );
    const newId = inserted.lastInsertId;

    for (const [index, line] of source.lines.entries()) {
      await db.execute(
        `INSERT INTO document_lines (
           document_id, sort_order, catalog_item_id, name, description, unit, quantity,
           unit_price_yen, tax_category, line_discount_yen, amount_yen
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          index,
          line.catalogItemId,
          line.name,
          line.description,
          line.unit,
          line.quantity,
          line.unitPriceYen,
          line.taxCategory,
          line.lineDiscountYen,
          0,
        ],
      );
    }

    await recordDocumentEvent(db, newId, "duplicated", null, "draft", `複製元ID: ${source.id}`);
    await db.execute("COMMIT");

    const created = await getDocument(db, newId);
    if (!created) {
      return err({ code: "duplicate_failed", message: "複製に失敗しました" });
    }
    return ok(created);
  } catch (error) {
    await db.execute("ROLLBACK").catch(() => undefined);
    return err(toAppError(error, "複製に失敗しました"));
  }
}
