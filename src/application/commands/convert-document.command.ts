import type { DatabasePort } from "@/application/ports/database";
import { recordDocumentEvent } from "@/application/commands/document-events.helper";
import { toAppError, type AppError } from "@/application/errors";
import { getDocument, type DocumentDetail } from "@/application/queries/get-document.query";
import { canConvertDocument, isConvertibleStatus } from "@/domain/documents/conversion";
import { canTransitionDocumentStatus, type DocumentStatus } from "@/domain/documents/status";
import type { DocumentType } from "@/domain/documents/types";
import { calculateDocumentTotals } from "@/domain/tax/calculate-document-totals";
import { err, ok, type Result } from "@/lib/result";

/** 変換すると元書類の状態も進む場合の遷移先(承認済み見積→請求書、請求書→領収書=入金)。 */
function autoSourceStatusAfterConversion(
  sourceType: DocumentType,
  targetType: DocumentType,
): DocumentStatus | null {
  if (sourceType === "estimate" && targetType === "invoice") return "invoiced";
  if (sourceType === "invoice" && targetType === "receipt") return "paid";
  return null;
}

export async function convertDocument(
  db: DatabasePort,
  sourceId: number,
  targetType: DocumentType,
): Promise<Result<DocumentDetail, AppError>> {
  try {
    const source = await getDocument(db, sourceId);
    if (!source) {
      return err({ code: "not_found", message: "元になる書類が見つかりません" });
    }
    if (!canConvertDocument(source.documentType, targetType)) {
      return err({ code: "invalid_conversion", message: "この書類はその種類へ変換できません" });
    }
    if (!isConvertibleStatus(source.status)) {
      return err({ code: "not_convertible", message: "発行済み以降の書類のみ変換できます" });
    }

    const totals = calculateDocumentTotals(
      source.lines.map((line) => ({
        quantity: line.quantity,
        unitPriceYen: line.unitPriceYen,
        taxCategory: line.taxCategory,
        lineDiscountYen: line.lineDiscountYen,
      })),
      {
        discountYen: source.discountYen,
        pricingType: source.pricingType,
        roundingMode: source.roundingMode,
      },
    );

    const now = new Date().toISOString();
    await db.execute("BEGIN");
    const inserted = await db.execute(
      `INSERT INTO documents (
         document_type, status, client_id, pricing_type, rounding_mode, discount_yen,
         subtotal_yen, tax_yen, total_yen, note, source_document_id, created_at, updated_at
       ) VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetType,
        source.clientId,
        source.pricingType,
        source.roundingMode,
        source.discountYen,
        totals.subtotalYen,
        totals.taxYen,
        totals.totalYen,
        source.note,
        source.id,
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
          totals.lines[index]?.amountYen ?? 0,
        ],
      );
    }

    const autoStatus = autoSourceStatusAfterConversion(source.documentType, targetType);
    if (autoStatus && canTransitionDocumentStatus(source.status, autoStatus)) {
      await db.execute(
        `UPDATE documents SET status = ?, updated_at = ? WHERE id = ? AND status = ?`,
        [autoStatus, now, source.id, source.status],
      );
      await recordDocumentEvent(
        db,
        source.id,
        "status_change",
        source.status,
        autoStatus,
        "変換に伴う自動更新",
      );
    }

    await recordDocumentEvent(
      db,
      source.id,
      `converted_to_${targetType}`,
      source.status,
      source.status,
      `変換先の書類ID: ${newId}`,
    );
    await recordDocumentEvent(
      db,
      newId,
      "created_from_conversion",
      null,
      "draft",
      `変換元: ${source.documentType} ID:${source.id}`,
    );
    await db.execute("COMMIT");

    const created = await getDocument(db, newId);
    if (!created) {
      return err({ code: "convert_failed", message: "変換に失敗しました" });
    }
    return ok(created);
  } catch (error) {
    await db.execute("ROLLBACK").catch(() => undefined);
    return err(toAppError(error, "変換に失敗しました"));
  }
}
