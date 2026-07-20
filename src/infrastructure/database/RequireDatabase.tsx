import type { ReactNode } from "react";
import { useDatabaseState } from "@/infrastructure/database/use-database";

interface RequireDatabaseProps {
  children: ReactNode;
}

export function RequireDatabase({ children }: RequireDatabaseProps) {
  const state = useDatabaseState();

  if (state.status === "loading") {
    return (
      <p role="status" style={{ padding: "2rem" }}>
        データベースを準備しています…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p role="alert" style={{ padding: "2rem" }}>
        {state.message}
      </p>
    );
  }

  return <>{children}</>;
}
