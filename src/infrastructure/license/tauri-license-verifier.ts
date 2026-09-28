import { invoke, isTauri } from "@tauri-apps/api/core";
import type { LicenseStatus, LicenseVerifierPort } from "@/application/ports/license";

/** Rust(src-tauri/src/commands/license.rs)で署名を検証する。例外は投げない。 */
export const tauriLicenseVerifier: LicenseVerifierPort = {
  async verify(key: string): Promise<LicenseStatus> {
    if (!isTauri()) return { state: "invalid", reason: "verifier_unavailable" };
    try {
      return await invoke<LicenseStatus>("verify_license_key", { key });
    } catch {
      return { state: "invalid", reason: "verifier_unavailable" };
    }
  },
};
