import type { ReactNode } from "react";
import { DatabaseProvider } from "@/infrastructure/database/database-context";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <DatabaseProvider>{children}</DatabaseProvider>;
}
