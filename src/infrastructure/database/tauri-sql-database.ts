import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import type { DatabasePort, QueryResult, TransactionStatement } from "@/application/ports/database";

// sqlxはforeign_keysプラグマを既定でONにするため、接続文字列での指定は不要。
const DB_URL = "sqlite:mitsumori-desk.db?mode=rwc";

interface RawTransactionStatementResult {
  rows_affected: number;
  last_insert_id: number;
}

export async function createTauriSqlDatabase(): Promise<DatabasePort> {
  const db = await Database.load(DB_URL);

  return {
    async execute(sql, params = []) {
      const result = await db.execute(sql, params);
      return { rowsAffected: result.rowsAffected, lastInsertId: result.lastInsertId ?? 0 };
    },
    async select<T>(sql: string, params: unknown[] = []) {
      return db.select<T[]>(sql, params);
    },
    async executeTransaction(statements: TransactionStatement[]): Promise<QueryResult[]> {
      const raw = await invoke<RawTransactionStatementResult[]>("execute_transaction", {
        statements: statements.map((statement) => ({
          sql: statement.sql,
          params: statement.params ?? [],
        })),
      });
      return raw.map((result) => ({
        rowsAffected: result.rows_affected,
        lastInsertId: result.last_insert_id,
      }));
    },
  };
}
