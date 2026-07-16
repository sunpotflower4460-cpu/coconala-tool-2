import type { SystemInfo, SystemInfoProvider } from "@/application/ports/system-info";

export function createFakeSystemInfoProvider(
  overrides: Partial<SystemInfo> = {},
): SystemInfoProvider {
  const info: SystemInfo = {
    appVersion: "0.1.0",
    os: "linux",
    osArch: "x86_64",
    dbSizeBytes: 4096,
    dbSchemaVersion: 3,
    ...overrides,
  };
  return {
    get() {
      return Promise.resolve(info);
    },
  };
}
