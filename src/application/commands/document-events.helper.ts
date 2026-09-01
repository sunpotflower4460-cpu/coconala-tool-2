import type { TransactionStatement } from "@/application/ports/database";

export function documentEventStatement(
  documentId: number | { $ref: number },
  eventType: string,
  fromStatus: string | null,
  toStatus: string | null,
  note: string | null = null,
): TransactionStatement {
  return {
    sql: `INSERT INTO document_events (document_id, event_type, from_status, to_status, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    params: [documentId, eventType, fromStatus, toStatus, note, new Date().toISOString()],
  };
}

/**
 * 直前のUPDATE/DELETEが1行以上変更した場合のみ履歴を残す。
 * 発行や状態変更の楽観ロック(WHERE status = 旧状態)が0件だったとき、
 * 発行済み書類へ誤って履歴だけ追記しないために使う。
 */
export function documentEventStatementIfPreviousWriteAffected(
  documentId: number | { $ref: number },
  eventType: string,
  fromStatus: string | null,
  toStatus: string | null,
  note: string | null = null,
): TransactionStatement {
  return {
    sql: `INSERT INTO document_events (document_id, event_type, from_status, to_status, note, created_at)
          SELECT ?, ?, ?, ?, ?, ? WHERE changes() > 0`,
    params: [documentId, eventType, fromStatus, toStatus, note, new Date().toISOString()],
  };
}
