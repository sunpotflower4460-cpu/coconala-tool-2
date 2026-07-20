import { invoke } from "@tauri-apps/api/core";
import type { SystemInfo, SystemInfoProvider } from "@/application/ports/system-info";

interface RawSystemDiagnostics {
  app_version: string;
  os: string;
  os_arch: string;
  db_size_bytes: number;
  db_schema_version: number | null;
}

export const tauriSystemInfoProvider: SystemInfoProvider = {
  async get(): Promise<SystemInfo> {
    const raw = await invoke<RawSystemDiagnostics>("get_system_diagnostics");
    return {
      appVersion: raw.app_version,
      os: raw.os,
      osArch: raw.os_arch,
      dbSizeBytes: raw.db_size_bytes,
      dbSchemaVersion: raw.db_schema_version,
    };
  },
};
