import type { DatabasePort } from "@/application/ports/database";
import { recordDocumentEvent } from "@/application/commands/document-events.helper";
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
    await db.execute("BEGIN");
    await db.execute(
      `UPDATE documents SET status = ?, updated_at = ? WHERE id = ? AND status = ?`,
      [toStatus, now, id, document.status],
    );
    await recordDocumentEvent(db, id, "status_change", document.status, toStatus, note);
    await db.execute("COMMIT");

    const updated = await getDocument(db, id);
    if (!updated) {
      return err({ code: "update_failed", message: "状態の更新に失敗しました" });
    }
    return ok(updated);
  } catch (error) {
    await db.execute("ROLLBACK").catch(() => undefined);
    return err(toAppError(error, "状態の更新に失敗しました"));
  }
}
