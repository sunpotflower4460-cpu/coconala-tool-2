import type { DatabasePort } from "@/application/ports/database";
import type { DocumentStatus } from "@/domain/documents/status";
import type { DocumentType } from "@/domain/documents/types";

export interface DerivedDocument {
  id: number;
  documentType: DocumentType;
  status: DocumentStatus;
  documentNumber: string | null;
}

/** この書類から変換して作った書類の一覧(二重作成の注意表示に使う)。 */
export async function listDerivedDocuments(
  db: DatabasePort,
  sourceId: number,
): Promise<DerivedDocument[]> {
  const rows = await db.select<{
    id: number;
    document_type: DocumentType;
    status: DocumentStatus;
    document_number: string | null;
  }>(
    `SELECT id, document_type, status, document_number FROM documents
     WHERE source_document_id = ? ORDER BY id`,
    [sourceId],
  );
  return rows.map((row) => ({
    id: row.id,
    documentType: row.document_type,
    status: row.status,
    documentNumber: row.document_number,
  }));
}
