import type { ReactNode } from "react";
import { DatabaseProvider } from "@/infrastructure/database/database-context";
import { tauriLicenseVerifier } from "@/infrastructure/license/tauri-license-verifier";
import { LicenseProvider } from "@/features/license/LicenseProvider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <DatabaseProvider>
      <LicenseProvider verifier={tauriLicenseVerifier}>{children}</LicenseProvider>
    </DatabaseProvider>
  );
}
