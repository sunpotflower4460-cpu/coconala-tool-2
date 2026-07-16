import type { DatabasePort } from "@/application/ports/database";
import { toAppError, type AppError } from "@/application/errors";
import { err, ok, type Result } from "@/lib/result";

/** 利用者が承認して見積下書きへ反映した後に、監査用として抽出記録へ紐付ける。 */
export async function confirmInquiryExtraction(
  db: DatabasePort,
  extractionId: number,
  documentId: number,
): Promise<Result<void, AppError>> {
  try {
    await db.execute(
      `UPDATE ai_extractions SET confirmed = 1, confirmed_at = ?, document_id = ? WHERE id = ?`,
      [new Date().toISOString(), documentId, extractionId],
    );
    return ok(undefined);
  } catch (error) {
    return err(toAppError(error, "確認状態の更新に失敗しました"));
  }
}
