import type { BackupStore } from "@/application/ports/backup-store";
import { toAppError, type AppError } from "@/application/errors";
import { err, ok, type Result } from "@/lib/result";

export async function exportBackup(
  store: BackupStore,
  backupFileName: string,
): Promise<Result<string | null, AppError>> {
  try {
    const path = await store.exportTo(backupFileName);
    return ok(path);
  } catch (error) {
    return err(toAppError(error, "バックアップの書き出しに失敗しました"));
  }
}
