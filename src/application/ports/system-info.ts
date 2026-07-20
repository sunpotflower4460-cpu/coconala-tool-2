export interface SystemInfo {
  appVersion: string;
  os: string;
  osArch: string;
  dbSizeBytes: number;
  dbSchemaVersion: number | null;
}

export interface SystemInfoProvider {
  get(): Promise<SystemInfo>;
}
