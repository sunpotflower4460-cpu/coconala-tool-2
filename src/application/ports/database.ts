export interface QueryResult {
  rowsAffected: number;
  lastInsertId: number;
}

/**
 * SQLite(またはテスト用の互換実装)への低レベルアクセス。
 * `infrastructure/database/`が実装し、`application/commands`・`application/queries`から利用する。
 */
export interface DatabasePort {
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
}
