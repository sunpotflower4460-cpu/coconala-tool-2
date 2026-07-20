import type { BackupInfo, BackupStore } from "@/application/ports/backup-store";

export function createFakeBackupStore(): BackupStore & { backups: BackupInfo[] } {
  const backups: BackupInfo[] = [];
  return {
    backups,
    create(label: string) {
      if (backups.some((backup) => backup.fileName === `mitsumori-desk-backup-${label}.db`)) {
        return Promise.reject(new Error("同名のバックアップが既に存在します"));
      }
      const info: BackupInfo = {
        fileName: `mitsumori-desk-backup-${label}.db`,
        sizeBytes: 1024,
        schemaVersion: 3,
      };
      backups.push(info);
      return Promise.resolve(info);
    },
    list() {
      return Promise.resolve([...backups]);
    },
    restore(backupFileName: string) {
      if (!backups.some((backup) => backup.fileName === backupFileName)) {
        return Promise.reject(new Error("バックアップファイルが見つかりません"));
      }
      return Promise.resolve();
    },
  };
}
