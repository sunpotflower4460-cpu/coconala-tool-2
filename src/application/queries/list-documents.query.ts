import type { DatabasePort } from "@/application/ports/database";
import type { DocumentStatus } from "@/domain/documents/status";
import type { DocumentType } from "@/domain/documents/types";

export interface DocumentSummary {
  id: number;
  documentType: DocumentType;
  documentNumber: string | null;
  status: DocumentStatus;
  clientName: string | null;
  totalYen: number;
  updatedAt: string;
}

interface DocumentSummaryRow {
  id: number;
  document_type: DocumentType;
  document_number: string | null;
  status: DocumentStatus;
  client_name: string | null;
  total_yen: number;
  updated_at: string;
}

export interface ListDocumentsOptions {
  documentType?: DocumentType;
}

export async function listDocuments(
  db: DatabasePort,
  options: ListDocumentsOptions = {},
): Promise<DocumentSummary[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (options.documentType) {
    conditions.push("d.document_type = ?");
    params.push(options.documentType);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await db.select<DocumentSummaryRow>(
    `SELECT d.id, d.document_type, d.document_number, d.status, c.name AS client_name,
            d.total_yen, d.updated_at
     FROM documents d
     LEFT JOIN clients c ON c.id = d.client_id
     ${where}
     ORDER BY d.updated_at DESC`,
    params,
  );

  return rows.map((row) => ({
    id: row.id,
    documentType: row.document_type,
    documentNumber: row.document_number,
    status: row.status,
    clientName: row.client_name,
    totalYen: row.total_yen,
    updatedAt: row.updated_at,
  }));
}
