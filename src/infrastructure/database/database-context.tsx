import { useEffect, useState, type ReactNode } from "react";
import { createTauriSqlDatabase } from "@/infrastructure/database/tauri-sql-database";
import { DatabaseContext, type DatabaseState } from "@/infrastructure/database/use-database";

interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [state, setState] = useState<DatabaseState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    createTauriSqlDatabase()
      .then((db) => {
        if (!cancelled) setState({ status: "ready", db });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "データベースに接続できません。デスクトップアプリとして起動してください。",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <DatabaseContext.Provider value={state}>{children}</DatabaseContext.Provider>;
}
