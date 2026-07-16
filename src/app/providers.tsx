import type { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

/**
 * アプリ全体のcontext providerをまとめる場所。
 * Phase 1でDatabaseProviderをここへ追加する。
 */
export function Providers({ children }: ProvidersProps) {
  return <>{children}</>;
}
