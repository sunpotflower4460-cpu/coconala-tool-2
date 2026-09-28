import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LicenseStatus, LicenseVerifierPort } from "@/application/ports/license";
import { getLicenseStatus } from "@/application/queries/get-license-status.query";
import { useDatabaseState } from "@/infrastructure/database/use-database";
import { LicenseContext } from "@/features/license/license-context";

interface LicenseProviderProps {
  verifier: LicenseVerifierPort;
  children: ReactNode;
}

export function LicenseProvider({ verifier, children }: LicenseProviderProps) {
  const dbState = useDatabaseState();
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (dbState.status !== "ready") return;
    let cancelled = false;
    void getLicenseStatus(dbState.db, verifier).then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [dbState, verifier, version]);

  const refresh = useCallback(() => setVersion((current) => current + 1), []);
  const value = useMemo(() => ({ status, verifier, refresh }), [status, verifier, refresh]);

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}
