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
