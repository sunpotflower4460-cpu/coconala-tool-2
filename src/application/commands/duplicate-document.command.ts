import type { DatabasePort, TransactionStatement } from "@/application/ports/database";
import { documentEventStatement } from "@/application/commands/document-events.helper";
import { refPreviousInsertId } from "@/application/ports/database";
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
    const statements: TransactionStatement[] = [
      {
        sql: `INSERT INTO documents (
           document_type, status, client_id, pricing_type, rounding_mode, discount_yen,
           subtotal_yen, tax_yen, total_yen, note, created_at, updated_at
         ) VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
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
      },
    ];
    const newDocumentIdRef = refPreviousInsertId(0);

    for (const [index, line] of source.lines.entries()) {
      statements.push({
        sql: `INSERT INTO document_lines (
           document_id, sort_order, catalog_item_id, name, description, unit, quantity,
           unit_price_yen, tax_category, line_discount_yen, amount_yen
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          newDocumentIdRef,
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
      });
    }

    statements.push(
      documentEventStatement(
        newDocumentIdRef,
        "duplicated",
        null,
        "draft",
        `複製元ID: ${source.id}`,
      ),
    );

    const results = await db.executeTransaction(statements);
    const newId = results[0]?.lastInsertId ?? 0;

    const created = await getDocument(db, newId);
    if (!created) {
      return err({ code: "duplicate_failed", message: "複製に失敗しました" });
    }
    return ok(created);
  } catch (error) {
    return err(toAppError(error, "複製に失敗しました"));
  }
}
