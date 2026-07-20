import type { BackupStore } from "@/application/ports/backup-store";
import { toAppError, type AppError } from "@/application/errors";
import { formatTimestampLabel } from "@/lib/formatting/timestamp-label";
import { err, ok, type Result } from "@/lib/result";

export async function restoreBackup(
  store: BackupStore,
  backupFileName: string,
  now: Date = new Date(),
): Promise<Result<void, AppError>> {
  try {
    await store.restore(backupFileName, `pre-restore-${formatTimestampLabel(now)}`);
    return ok(undefined);
  } catch (error) {
    return err(toAppError(error, "復元に失敗しました"));
  }
}
