import { createContext, useContext } from "react";
import type { LicenseStatus, LicenseVerifierPort } from "@/application/ports/license";

export interface LicenseContextValue {
  /** null は確認中 */
  status: LicenseStatus | null;
  verifier: LicenseVerifierPort;
  refresh(): void;
}

// Provider外(単体テストなど)では「未登録」として扱う。透かし以外の機能には影響しない。
export const LicenseContext = createContext<LicenseContextValue>({
  status: { state: "unlicensed" },
  verifier: {
    verify: () => Promise.resolve({ state: "invalid", reason: "verifier_unavailable" }),
  },
  refresh: () => undefined,
});

export function useLicense(): LicenseContextValue {
  return useContext(LicenseContext);
}
