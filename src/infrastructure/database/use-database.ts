import { createContext, useContext } from "react";
import type { DatabasePort } from "@/application/ports/database";

export type DatabaseState =
  | { status: "loading" }
  | { status: "ready"; db: DatabasePort }
  | { status: "error"; message: string };

export const DatabaseContext = createContext<DatabaseState>({ status: "loading" });

export function useDatabaseState(): DatabaseState {
  return useContext(DatabaseContext);
}

/** DB接続が確立していない場合はエラーを投げる。準備状態の分岐はUI側で行うこと。 */
export function useDatabase(): DatabasePort {
  const state = useDatabaseState();
  if (state.status !== "ready") {
    throw new Error("データベースの準備ができていません");
  }
  return state.db;
}
