import type { DatabasePort } from "@/application/ports/database";
import type { DocumentStatus } from "@/domain/documents/status";
import type { DocumentDraft, DocumentLine, DocumentType } from "@/domain/documents/types";
import type { PricingType, RoundingMode, TaxCategory } from "@/domain/tax/types";

interface DocumentHeaderRow {
  id: number;
  document_type: DocumentType;
  document_number: string | null;
  status: DocumentStatus;
  client_id: number | null;
  issue_date: string | null;
  due_date: string | null;
  valid_until: string | null;
  pricing_type: PricingType;
  rounding_mode: RoundingMode;
  discount_yen: number;
  note: string | null;
}

interface DocumentLineRow {
  id: number;
  sort_order: number;
  catalog_item_id: number | null;
  name: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  unit_price_yen: number;
  tax_category: TaxCategory;
  line_discount_yen: number;
}

function mapLineRow(row: DocumentLineRow): DocumentLine {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    catalogItemId: row.catalog_item_id,
    name: row.name,
    description: row.description,
    unit: row.unit,
    quantity: row.quantity,
    unitPriceYen: row.unit_price_yen,
    taxCategory: row.tax_category,
    lineDiscountYen: row.line_discount_yen,
  };
}

export async function getDocumentDraft(
  db: DatabasePort,
  id: number,
): Promise<DocumentDraft | null> {
  const headerRows = await db.select<DocumentHeaderRow>(
    `SELECT id, document_type, document_number, status, client_id, issue_date, due_date, valid_until,
            pricing_type, rounding_mode, discount_yen, note
     FROM documents WHERE id = ?`,
    [id],
  );
  const header = headerRows[0];
  if (!header) return null;

  const lineRows = await db.select<DocumentLineRow>(
    `SELECT id, sort_order, catalog_item_id, name, description, unit, quantity, unit_price_yen,
            tax_category, line_discount_yen
     FROM document_lines WHERE document_id = ? ORDER BY sort_order ASC`,
    [id],
  );

  return {
    header: {
      id: header.id,
      documentType: header.document_type,
      documentNumber: header.document_number,
      status: header.status,
      clientId: header.client_id,
      issueDate: header.issue_date,
      dueDate: header.due_date,
      validUntil: header.valid_until,
      pricingType: header.pricing_type,
      roundingMode: header.rounding_mode,
      discountYen: header.discount_yen,
      note: header.note,
    },
    lines: lineRows.map(mapLineRow),
  };
}
