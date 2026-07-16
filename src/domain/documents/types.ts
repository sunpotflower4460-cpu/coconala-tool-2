import type { PricingType, RoundingMode, TaxCategory } from "@/domain/tax/types";
import type { DocumentStatus } from "@/domain/documents/status";

export type DocumentType = "estimate" | "invoice" | "delivery_note" | "receipt";

export interface DocumentLine {
  id: number | null;
  sortOrder: number;
  catalogItemId: number | null;
  name: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  unitPriceYen: number;
  taxCategory: TaxCategory;
  lineDiscountYen: number;
}

export interface DocumentHeader {
  id: number | null;
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
  note: string | null;
}

export interface DocumentDraft {
  header: DocumentHeader;
  lines: DocumentLine[];
}
