import type { DatabasePort, TransactionStatement } from "@/application/ports/database";
import { documentEventStatementIfPreviousWriteAffected } from "@/application/commands/document-events.helper";
import { toAppError, type AppError } from "@/application/errors";
import { getDocument, type DocumentDetail } from "@/application/queries/get-document.query";
import { canTransitionDocumentStatus, type DocumentStatus } from "@/domain/documents/status";
import { err, ok, type Result } from "@/lib/result";

export async function updateDocumentStatus(
  db: DatabasePort,
  id: number,
  toStatus: DocumentStatus,
  note: string | null = null,
): Promise<Result<DocumentDetail, AppError>> {
  try {
    const document = await getDocument(db, id);
    if (!document) {
      return err({ code: "not_found", message: "書類が見つかりません" });
    }
    if (!canTransitionDocumentStatus(document.status, toStatus)) {
      return err({
        code: "invalid_transition",
        message: "その状態には変更できません",
      });
    }

    const now = new Date().toISOString();
    const statements: TransactionStatement[] = [
      {
        sql: `UPDATE documents SET status = ?, updated_at = ? WHERE id = ? AND status = ?`,
        params: [toStatus, now, id, document.status],
      },
      documentEventStatementIfPreviousWriteAffected(
        id,
        "status_change",
        document.status,
        toStatus,
        note,
      ),
    ];
    const results = await db.executeTransaction(statements);
    if ((results[0]?.rowsAffected ?? 0) !== 1) {
      return err({
        code: "invalid_transition",
        message: "その状態には変更できません",
      });
    }

    const updated = await getDocument(db, id);
    if (!updated) {
      return err({ code: "update_failed", message: "状態の更新に失敗しました" });
    }
    return ok(updated);
  } catch (error) {
    return err(toAppError(error, "状態の更新に失敗しました"));
  }
}
