import type { BackupInfo, BackupStore } from "@/application/ports/backup-store";

export function createFakeBackupStore(): BackupStore & {
  backups: BackupInfo[];
  nextExportCancelled: boolean;
  nextImportCancelled: boolean;
} {
  const backups: BackupInfo[] = [];
  const store = {
    backups,
    nextExportCancelled: false,
    nextImportCancelled: false,
    create(label: string) {
      if (backups.some((backup) => backup.fileName === `mitsumori-desk-backup-${label}.db`)) {
        return Promise.reject(new Error("同名のバックアップが既に存在します"));
      }
      const info: BackupInfo = {
        fileName: `mitsumori-desk-backup-${label}.db`,
        sizeBytes: 1024,
        schemaVersion: 3,
        appVersion: "0.1.0",
        createdAtUnix: 1_700_000_000,
        os: "linux",
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
    exportTo(backupFileName: string) {
      if (store.nextExportCancelled) return Promise.resolve(null);
      if (!backups.some((backup) => backup.fileName === backupFileName)) {
        return Promise.reject(new Error("バックアップファイルが見つかりません"));
      }
      return Promise.resolve(`/exported/${backupFileName}`);
    },
    importFrom(label: string) {
      if (store.nextImportCancelled) return Promise.resolve(null);
      const info: BackupInfo = {
        fileName: `mitsumori-desk-backup-${label}.db`,
        sizeBytes: 2048,
        schemaVersion: 3,
        appVersion: "0.1.0",
        createdAtUnix: 1_700_000_100,
        os: "linux",
      };
      backups.push(info);
      return Promise.resolve(info);
    },
  };
  return store;
}
