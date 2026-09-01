import type { DatabasePort, TransactionStatement } from "@/application/ports/database";
import { refPreviousInsertId } from "@/application/ports/database";
import { toAppError, type AppError } from "@/application/errors";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import { getDocumentDraft } from "@/application/queries/get-document-draft.query";
import { isEditableStatus } from "@/domain/documents/status";
import type { DocumentDraft } from "@/domain/documents/types";
import { calculateDocumentTotals } from "@/domain/tax/calculate-document-totals";
import type { PricingType, TaxCategory } from "@/domain/tax/types";
import { err, ok, type Result } from "@/lib/result";

export interface SaveEstimateDraftLineInput {
  catalogItemId: number | null;
  name: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  unitPriceYen: number;
  taxCategory: TaxCategory;
  lineDiscountYen: number;
}

export interface SaveEstimateDraftInput {
  id: number | null;
  clientId: number | null;
  issueDate: string | null;
  dueDate: string | null;
  validUntil: string | null;
  pricingType: PricingType;
  discountYen: number;
  note: string | null;
  lines: SaveEstimateDraftLineInput[];
}

export async function saveEstimateDraft(
  db: DatabasePort,
  input: SaveEstimateDraftInput,
): Promise<Result<DocumentDraft, AppError>> {
  try {
    const settings = await getAppSettings(db);
    const totals = calculateDocumentTotals(
      input.lines.map((line) => ({
        quantity: line.quantity,
        unitPriceYen: line.unitPriceYen,
        taxCategory: line.taxCategory,
        lineDiscountYen: line.lineDiscountYen,
      })),
      {
        discountYen: input.discountYen,
        pricingType: input.pricingType,
        roundingMode: settings.roundingMode,
      },
    );

    const now = new Date().toISOString();
    const statements: TransactionStatement[] = [];
    let documentIdParam: number | { $ref: number };

    if (input.id === null) {
      statements.push({
        sql: `INSERT INTO documents (
           document_type, status, client_id, issue_date, due_date, valid_until, pricing_type,
           rounding_mode, discount_yen, subtotal_yen, tax_yen, total_yen, note, created_at, updated_at
         ) VALUES ('estimate', 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          input.clientId,
          input.issueDate,
          input.dueDate,
          input.validUntil,
          input.pricingType,
          settings.roundingMode,
          input.discountYen,
          totals.subtotalYen,
          totals.taxYen,
          totals.totalYen,
          input.note,
          now,
          now,
        ],
      });
      documentIdParam = refPreviousInsertId(0);
    } else {
      const existing = await getDocumentDraft(db, input.id);
      if (!existing || !isEditableStatus(existing.header.status)) {
        return err({
          code: "not_editable",
          message: "この見積は編集できません(発行済みの可能性があります)",
        });
      }
      statements.push({
        sql: `UPDATE documents SET
           client_id = ?, issue_date = ?, due_date = ?, valid_until = ?, pricing_type = ?,
           rounding_mode = ?, discount_yen = ?, subtotal_yen = ?, tax_yen = ?, total_yen = ?,
           note = ?, updated_at = ?
         WHERE id = ? AND status = 'draft'`,
        params: [
          input.clientId,
          input.issueDate,
          input.dueDate,
          input.validUntil,
          input.pricingType,
          settings.roundingMode,
          input.discountYen,
          totals.subtotalYen,
          totals.taxYen,
          totals.totalYen,
          input.note,
          now,
          input.id,
        ],
      });
      // 発行と保存が競合した場合、発行済み明細を消さない(下書きのときだけ差し替える)。
      statements.push({
        sql: `DELETE FROM document_lines
              WHERE document_id = ?
                AND EXISTS (SELECT 1 FROM documents WHERE id = ? AND status = 'draft')`,
        params: [input.id, input.id],
      });
      documentIdParam = input.id;
    }

    for (const [index, line] of input.lines.entries()) {
      statements.push({
        sql: `INSERT INTO document_lines (
           document_id, sort_order, catalog_item_id, name, description, unit, quantity,
           unit_price_yen, tax_category, line_discount_yen, amount_yen
         )
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM documents WHERE id = ? AND status = 'draft')`,
        params: [
          documentIdParam,
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
          documentIdParam,
        ],
      });
    }

    const results = await db.executeTransaction(statements);
    if (input.id !== null && (results[0]?.rowsAffected ?? 0) !== 1) {
      return err({
        code: "not_editable",
        message: "この見積は編集できません(発行済みの可能性があります)",
      });
    }
    const documentId = input.id === null ? (results[0]?.lastInsertId ?? 0) : input.id;

    const saved = await getDocumentDraft(db, documentId);
    if (!saved) {
      return err({ code: "save_failed", message: "見積の保存に失敗しました" });
    }
    return ok(saved);
  } catch (error) {
    return err(toAppError(error, "見積の保存に失敗しました"));
  }
}
