import Database from "@tauri-apps/plugin-sql";
import type { DatabasePort } from "@/application/ports/database";

// sqlxはforeign_keysプラグマを既定でONにするため、接続文字列での指定は不要。
const DB_URL = "sqlite:mitsumori-desk.db?mode=rwc";

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
  };
}
