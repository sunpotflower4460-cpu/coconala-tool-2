import type { DatabasePort } from "@/application/ports/database";
import { toAppError, type AppError } from "@/application/errors";
import { err, ok, type Result } from "@/lib/result";

// is_practice_data = 1 のデータのみを削除する。実データ(顧客・価格表・会社情報・書類)には触れない。
export async function deletePracticeData(db: DatabasePort): Promise<Result<void, AppError>> {
  try {
    await db.executeTransaction([
      { sql: `DELETE FROM documents WHERE is_practice_data = 1` },
      { sql: `DELETE FROM clients WHERE is_practice_data = 1` },
      { sql: `DELETE FROM catalog_items WHERE is_practice_data = 1` },
      { sql: `DELETE FROM companies WHERE id = 1 AND is_practice_data = 1` },
    ]);
    return ok(undefined);
  } catch (error) {
    return err(toAppError(error, "練習用データの削除に失敗しました"));
  }
}
