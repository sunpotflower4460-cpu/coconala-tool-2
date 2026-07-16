import type { DatabasePort } from "@/application/ports/database";

export async function recordDocumentEvent(
  db: DatabasePort,
  documentId: number,
  eventType: string,
  fromStatus: string | null,
  toStatus: string | null,
  note: string | null = null,
): Promise<void> {
  await db.execute(
    `INSERT INTO document_events (document_id, event_type, from_status, to_status, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [documentId, eventType, fromStatus, toStatus, note, new Date().toISOString()],
  );
}
