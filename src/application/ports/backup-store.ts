export interface BackupInfo {
  fileName: string;
  sizeBytes: number;
  schemaVersion: number | null;
}

export interface BackupStore {
  create(label: string): Promise<BackupInfo>;
  list(): Promise<BackupInfo[]>;
  restore(backupFileName: string, preRestoreLabel: string): Promise<void>;
}
