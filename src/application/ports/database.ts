export interface QueryResult {
  rowsAffected: number;
  lastInsertId: number;
}

export interface TransactionStatement {
  sql: string;
  params?: unknown[];
}

/**
 * `executeTransaction`内で、それ以前の文がINSERTで採番したIDを後続の文のパラメータとして使う。
 * 例: 新規作成した書類のidを、続く明細INSERTのdocument_idとして参照する。
 */
export function refPreviousInsertId(statementIndex: number): { $ref: number } {
  return { $ref: statementIndex };
}

/**
 * SQLite(またはテスト用の互換実装)への低レベルアクセス。
 * `infrastructure/database/`が実装し、`application/commands`・`application/queries`から利用する。
 *
 * 注意: `execute`/`select`はtauri-plugin-sqlのコネクションプールを経由するため、
 * 複数の`execute`呼び出しをまたぐ手動の BEGIN/COMMIT では原子性を保証できない
 * (それぞれ別の接続に振り分けられうるため)。複数文にまたがる真のトランザクションが
 * 必要な場合は必ず`executeTransaction`を使うこと。
 */
export interface DatabasePort {
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  executeTransaction(statements: TransactionStatement[]): Promise<QueryResult[]>;
}
