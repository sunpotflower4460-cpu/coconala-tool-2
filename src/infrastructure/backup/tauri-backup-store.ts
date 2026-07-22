import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { BackupInfo, BackupStore } from "@/application/ports/backup-store";

interface RawBackupInfo {
  file_name: string;
  size_bytes: number;
  schema_version: number | null;
  app_version: string | null;
  created_at_unix: number | null;
  os: string | null;
}

function mapBackupInfo(raw: RawBackupInfo): BackupInfo {
  return {
    fileName: raw.file_name,
    sizeBytes: raw.size_bytes,
    schemaVersion: raw.schema_version,
    appVersion: raw.app_version,
    createdAtUnix: raw.created_at_unix,
    os: raw.os,
  };
}

export const tauriBackupStore: BackupStore = {
  async create(label: string): Promise<BackupInfo> {
    const raw = await invoke<RawBackupInfo>("backup_database", { label });
    return mapBackupInfo(raw);
  },
  async list(): Promise<BackupInfo[]> {
    const raw = await invoke<RawBackupInfo[]>("list_backups");
    return raw.map(mapBackupInfo);
  },
  async restore(backupFileName: string, preRestoreLabel: string): Promise<void> {
    await invoke("restore_database", { backupFileName, preRestoreLabel });
  },
  async exportTo(backupFileName: string): Promise<string | null> {
    const destinationPath = await save({ defaultPath: backupFileName });
    if (!destinationPath) return null;
    await invoke("export_backup_to", { backupFileName, destinationPath });
    return destinationPath;
  },
  async importFrom(label: string): Promise<BackupInfo | null> {
    const sourcePath = await open({
      multiple: false,
      filters: [{ name: "バックアップファイル", extensions: ["db"] }],
    });
    if (!sourcePath) return null;
    const raw = await invoke<RawBackupInfo>("import_backup_from", { sourcePath, label });
    return mapBackupInfo(raw);
  },
};
