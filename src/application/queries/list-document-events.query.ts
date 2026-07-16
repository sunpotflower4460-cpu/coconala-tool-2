import type { DatabasePort } from "@/application/ports/database";

export interface DocumentEvent {
  id: number;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
}

interface DocumentEventRow {
  id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
}

export async function listDocumentEvents(
  db: DatabasePort,
  documentId: number,
): Promise<DocumentEvent[]> {
  const rows = await db.select<DocumentEventRow>(
    `SELECT id, event_type, from_status, to_status, note, created_at
     FROM document_events WHERE document_id = ? ORDER BY created_at ASC, id ASC`,
    [documentId],
  );
  return rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note,
    createdAt: row.created_at,
  }));
}
