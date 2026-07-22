export interface BackupInfo {
  fileName: string;
  sizeBytes: number;
  schemaVersion: number | null;
  appVersion: string | null;
  createdAtUnix: number | null;
  os: string | null;
}

export interface BackupStore {
  create(label: string): Promise<BackupInfo>;
  list(): Promise<BackupInfo[]>;
  restore(backupFileName: string, preRestoreLabel: string): Promise<void>;
  // 保存先は購入者がダイアログで選ぶ。キャンセル時はnullを返す。
  exportTo(backupFileName: string): Promise<string | null>;
  // 取り込み元は購入者がダイアログで選ぶ。キャンセル時はnullを返す。
  importFrom(label: string): Promise<BackupInfo | null>;
}
