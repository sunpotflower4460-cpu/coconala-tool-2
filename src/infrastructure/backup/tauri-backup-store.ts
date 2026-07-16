import { invoke } from "@tauri-apps/api/core";
import type { BackupInfo, BackupStore } from "@/application/ports/backup-store";

interface RawBackupInfo {
  file_name: string;
  size_bytes: number;
  schema_version: number | null;
}

function mapBackupInfo(raw: RawBackupInfo): BackupInfo {
  return {
    fileName: raw.file_name,
    sizeBytes: raw.size_bytes,
    schemaVersion: raw.schema_version,
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
};
