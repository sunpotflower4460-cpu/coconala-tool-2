import type { DatabasePort } from "@/application/ports/database";
import type { CalculationSnapshot } from "@/domain/documents/snapshot";
import type { DocumentStatus } from "@/domain/documents/status";
import type { DocumentLine, DocumentType } from "@/domain/documents/types";
import type { Client } from "@/domain/clients/types";
import type { Company } from "@/domain/shared/company";
import type { PricingType, RoundingMode, TaxCategory } from "@/domain/tax/types";

interface DocumentRow {
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
  subtotal_yen: number;
  tax_yen: number;
  total_yen: number;
  note: string | null;
  company_snapshot_json: string | null;
  client_snapshot_json: string | null;
  calculation_snapshot_json: string | null;
  source_document_id: number | null;
  created_at: string;
  updated_at: string;
  issued_at: string | null;
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

export interface DocumentDetail {
  id: number;
  documentType: DocumentType;
  documentNumber: string | null;
  status: DocumentStatus;
  clientId: number | null;
  issueDate: string | null;
  dueDate: string | null;
  validUntil: string | null;
  pricingType: PricingType;
  roundingMode: RoundingMode;
  discountYen: number;
  subtotalYen: number;
  taxYen: number;
  totalYen: number;
  note: string | null;
  companySnapshot: Company | null;
  clientSnapshot: Client | null;
  calculationSnapshot: CalculationSnapshot | null;
  sourceDocumentId: number | null;
  createdAt: string;
  updatedAt: string;
  issuedAt: string | null;
  lines: DocumentLine[];
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

export async function getDocument(db: DatabasePort, id: number): Promise<DocumentDetail | null> {
  const rows = await db.select<DocumentRow>(
    `SELECT id, document_type, document_number, status, client_id, issue_date, due_date, valid_until,
            pricing_type, rounding_mode, discount_yen, subtotal_yen, tax_yen, total_yen, note,
            company_snapshot_json, client_snapshot_json, calculation_snapshot_json,
            source_document_id, created_at, updated_at, issued_at
     FROM documents WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;

  const lineRows = await db.select<DocumentLineRow>(
    `SELECT id, sort_order, catalog_item_id, name, description, unit, quantity, unit_price_yen,
            tax_category, line_discount_yen
     FROM document_lines WHERE document_id = ? ORDER BY sort_order ASC`,
    [id],
  );

  return {
    id: row.id,
    documentType: row.document_type,
    documentNumber: row.document_number,
    status: row.status,
    clientId: row.client_id,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    validUntil: row.valid_until,
    pricingType: row.pricing_type,
    roundingMode: row.rounding_mode,
    discountYen: row.discount_yen,
    subtotalYen: row.subtotal_yen,
    taxYen: row.tax_yen,
    totalYen: row.total_yen,
    note: row.note,
    companySnapshot: row.company_snapshot_json
      ? (JSON.parse(row.company_snapshot_json) as Company)
      : null,
    clientSnapshot: row.client_snapshot_json
      ? (JSON.parse(row.client_snapshot_json) as Client)
      : null,
    calculationSnapshot: row.calculation_snapshot_json
      ? (JSON.parse(row.calculation_snapshot_json) as CalculationSnapshot)
      : null,
    sourceDocumentId: row.source_document_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    issuedAt: row.issued_at,
    lines: lineRows.map(mapLineRow),
  };
}
