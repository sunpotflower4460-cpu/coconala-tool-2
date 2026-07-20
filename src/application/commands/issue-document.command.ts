import type { DatabasePort, TransactionStatement } from "@/application/ports/database";
import { documentEventStatement } from "@/application/commands/document-events.helper";
import { toAppError, type AppError } from "@/application/errors";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import { getCompany } from "@/application/queries/get-company.query";
import { getDocument, type DocumentDetail } from "@/application/queries/get-document.query";
import { getClient } from "@/application/queries/list-clients.query";
import { canTransitionDocumentStatus } from "@/domain/documents/status";
import { formatDocumentNumber, nextDocumentSequence } from "@/domain/documents/document-number";
import { buildCalculationSnapshot } from "@/domain/documents/snapshot";
import type { DocumentType } from "@/domain/documents/types";
import { calculateDocumentTotals } from "@/domain/tax/calculate-document-totals";
import type { AppSettings } from "@/domain/shared/app-settings";
import { err, ok, type Result } from "@/lib/result";

function prefixFor(documentType: DocumentType, settings: AppSettings): string {
  switch (documentType) {
    case "estimate":
      return settings.documentNumberPrefixEstimate;
    case "invoice":
      return settings.documentNumberPrefixInvoice;
    case "delivery_note":
      return settings.documentNumberPrefixDelivery;
    case "receipt":
      return settings.documentNumberPrefixReceipt;
  }
}

export async function issueDocument(
  db: DatabasePort,
  id: number,
): Promise<Result<DocumentDetail, AppError>> {
  try {
    const document = await getDocument(db, id);
    if (!document) {
      return err({ code: "not_found", message: "書類が見つかりません" });
    }
    if (!canTransitionDocumentStatus(document.status, "issued")) {
      return err({ code: "not_issuable", message: "この書類は発行できる状態ではありません" });
    }
    if (document.clientId === null) {
      return err({ code: "client_required", message: "発行する前に顧客を選択してください" });
    }

    const company = await getCompany(db);
    if (!company) {
      return err({ code: "company_required", message: "発行する前に会社情報を登録してください" });
    }
    const client = await getClient(db, document.clientId);
    if (!client) {
      return err({ code: "client_required", message: "選択されている顧客が見つかりません" });
    }

    const settings = await getAppSettings(db);
    const issueDate = document.issueDate ?? new Date().toISOString().slice(0, 10);
    const year = Number(issueDate.slice(0, 4));
    const prefix = prefixFor(document.documentType, settings);

    const existingRows = await db.select<{ document_number: string }>(
      `SELECT document_number FROM documents WHERE document_type = ? AND document_number IS NOT NULL`,
      [document.documentType],
    );
    const sequence = nextDocumentSequence(
      existingRows.map((row) => row.document_number),
      prefix,
      year,
    );
    const documentNumber = formatDocumentNumber(prefix, year, sequence);

    const totals = calculateDocumentTotals(
      document.lines.map((line) => ({
        quantity: line.quantity,
        unitPriceYen: line.unitPriceYen,
        taxCategory: line.taxCategory,
        lineDiscountYen: line.lineDiscountYen,
      })),
      {
        discountYen: document.discountYen,
        pricingType: document.pricingType,
        roundingMode: document.roundingMode,
      },
    );
    const calculationSnapshot = buildCalculationSnapshot(totals, {
      pricingType: document.pricingType,
      roundingMode: document.roundingMode,
      discountYen: document.discountYen,
    });

    const now = new Date().toISOString();
    const statements: TransactionStatement[] = [
      {
        sql: `UPDATE documents SET
           status = 'issued', document_number = ?, issue_date = ?, subtotal_yen = ?, tax_yen = ?,
           total_yen = ?, company_snapshot_json = ?, client_snapshot_json = ?,
           calculation_snapshot_json = ?, issued_at = ?, updated_at = ?
         WHERE id = ? AND status = 'draft'`,
        params: [
          documentNumber,
          issueDate,
          totals.subtotalYen,
          totals.taxYen,
          totals.totalYen,
          JSON.stringify(company),
          JSON.stringify(client),
          JSON.stringify(calculationSnapshot),
          now,
          now,
          id,
        ],
      },
      documentEventStatement(id, "issue", document.status, "issued"),
    ];
    await db.executeTransaction(statements);

    const issued = await getDocument(db, id);
    if (!issued) {
      return err({ code: "issue_failed", message: "発行処理に失敗しました" });
    }
    return ok(issued);
  } catch (error) {
    return err(toAppError(error, "発行処理に失敗しました"));
  }
}
