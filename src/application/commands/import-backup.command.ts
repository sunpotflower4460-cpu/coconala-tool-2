import type { BackupInfo, BackupStore } from "@/application/ports/backup-store";
import { toAppError, type AppError } from "@/application/errors";
import { formatTimestampLabel } from "@/lib/formatting/timestamp-label";
import { err, ok, type Result } from "@/lib/result";

export async function importBackup(
  store: BackupStore,
  now: Date = new Date(),
): Promise<Result<BackupInfo | null, AppError>> {
  try {
    const info = await store.importFrom(`imported-${formatTimestampLabel(now)}`);
    return ok(info);
  } catch (error) {
    return err(toAppError(error, "バックアップの取り込みに失敗しました"));
  }
}
