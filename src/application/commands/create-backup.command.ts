import type { BackupInfo, BackupStore } from "@/application/ports/backup-store";
import { toAppError, type AppError } from "@/application/errors";
import { formatTimestampLabel } from "@/lib/formatting/timestamp-label";
import { err, ok, type Result } from "@/lib/result";

export async function createBackup(
  store: BackupStore,
  now: Date = new Date(),
): Promise<Result<BackupInfo, AppError>> {
  try {
    const info = await store.create(formatTimestampLabel(now));
    return ok(info);
  } catch (error) {
    return err(toAppError(error, "バックアップの作成に失敗しました"));
  }
}
